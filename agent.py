import warnings
warnings.filterwarnings("ignore")

import os
import traceback
import asyncio
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# --- FastAPI & Server Imports ---
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# --- Local Imports ---
from agent_helpers.tools import VectorStore, web_search, run_python_analysis, generate_chart
from agent_helpers.types import AgentState, WorkItem, print_tree, Hypothesis, Analysis
from agent_helpers.research import ResearchAgent
from agent_helpers.strat import StrategistAgent

load_dotenv()

from dataclasses import asdict, is_dataclass

def _to_jsonable(obj):
    """Best-effort conversion to purely JSON-serializable structures."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_to_jsonable(v) for v in obj]
    # pydantic v2
    if hasattr(obj, "model_dump") and callable(getattr(obj, "model_dump")):
        return _to_jsonable(obj.model_dump())
    # pydantic v1
    if hasattr(obj, "dict") and callable(getattr(obj, "dict")):
        return _to_jsonable(obj.dict())
    # dataclass
    if is_dataclass(obj):
        return _to_jsonable(asdict(obj))
    # fallback
    return str(obj)

# ============================================================
# SETUP & INITIALIZATION
# ============================================================

# 1. Load LLM
def load_llm():
    try:
        if "OPENAI_API_KEY" not in os.environ:
            print("CRITICAL: OPENAI_API_KEY missing.")
            return None
        return ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    except Exception as e:
        print(f"Error loading LLM: {e}")
        return None

llm = load_llm()

# 2. Initialize Globals
agent_tools = {}
agents = {}
agent_app = None # The compiled graph

# 3. Initialize Tools & Agents (Run immediately so Server has them)
if llm:
    try:
        print("Initializing Tools & Agents...")
        agent_tools["vector_store"] = VectorStore()
        agent_tools["web_search"] = web_search
        agent_tools["python_repl"] = run_python_analysis
        agent_tools["chart_gen"] = generate_chart
        
        # Pass web_search to Strategist for "Research First" logic
        agents["strategist"] = StrategistAgent(llm, agent_tools["web_search"])
        
        # Pass all tools to Researcher
        agents["researcher"] = ResearchAgent(
            llm, 
            agent_tools["vector_store"], 
            agent_tools["web_search"],
            agent_tools["python_repl"],
            agent_tools["chart_gen"]
        )
        print("Agents Initialized Successfully.")
    except Exception as e:
        print(f"Failed to initialize agents: {e}")
        traceback.print_exc()

# ============================================================
# GRAPH LOGIC
# ============================================================

def start_process(state: AgentState) -> dict:
    problem = state["problem_statement"]
    return {
        "hypothesis_tree": [],
        "analyses_needed": [],
        "nodes_to_process": [],
        "explainability_log": [f"Problem statement defined: {problem}"],
        "last_completed_item_id": None
    }

def wait_for_approval(state: AgentState):
    # In server mode, this just acts as a pass-through / final status update
    return {"explainability_log": ["Workflow paused for approval (Complete)."]}

def compile_report(state: AgentState):
    # In API mode, this data is already sent via stream, but we keep it for graph correctness
    return {}

def route_action(state: AgentState) -> str:
    if not state["nodes_to_process"]:
        return "wait_for_approval"

    next_item = state["nodes_to_process"][0]
    next_action = next_item["action"]
    
    if next_action == "breakdown":
        return "breakdown_hypothesis"
    elif next_action == "classify":
        return "classify_hypothesis"
    elif next_action == "analyze":
        return "identify_analysis"
    
    return "wait_for_approval"

def build_graph():
    if not agents:
        raise RuntimeError("Agents not initialized. Check logs for setup errors.")

    workflow = StateGraph(AgentState)
    
    workflow.add_node("start_process", start_process)
    workflow.add_node("formulate_top_hypothesis", agents["strategist"].formulate_top_hypothesis)
    workflow.add_node("breakdown_hypothesis", agents["strategist"].breakdown_hypothesis)
    workflow.add_node("classify_hypothesis", agents["researcher"].classify_hypothesis)
    workflow.add_node("identify_analysis", agents["researcher"].identify_analysis)
    workflow.add_node("wait_for_approval", wait_for_approval)
    workflow.add_node("compile_report", compile_report)

    workflow.set_entry_point("start_process")

    workflow.add_edge("start_process", "formulate_top_hypothesis")
    
    destinations = {
        "breakdown_hypothesis": "breakdown_hypothesis", 
        "classify_hypothesis": "classify_hypothesis", 
        "identify_analysis": "identify_analysis", 
        "wait_for_approval": "wait_for_approval"
    }
    
    workflow.add_conditional_edges("formulate_top_hypothesis", route_action, destinations)
    workflow.add_conditional_edges("breakdown_hypothesis", route_action, destinations)
    workflow.add_conditional_edges("classify_hypothesis", route_action, destinations)
    workflow.add_conditional_edges("identify_analysis", route_action, destinations)

    workflow.add_edge("wait_for_approval", "compile_report")
    workflow.add_edge("compile_report", END)
    
    return workflow.compile()

# Compile the graph immediately on startup
try:
    if llm:
        agent_app = build_graph()
        print("Graph Compiled Successfully.")
except Exception as e:
    print(f"Graph compilation failed: {e}")

# ============================================================
# SERVER & STREAMING LOGIC
# ============================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def real_agent_generator(problem: str):
    if not agent_app:
        yield json.dumps({"explainability_log": ["Error: Agent not initialized (Check API Keys)."]}) + "\n"
        return

    inputs = {"problem_statement": problem}

    try:
        async for output in agent_app.astream(inputs, config={"recursion_limit": 50}):
            for node_name, state_update in output.items():
                safe = _to_jsonable(state_update) or {}

                # Pull ids if the node just completed something (many of your nodes already set this)
                completed_id = safe.get("last_completed_item_id")

                # Build/augment logs so they always contain the node name (and id when we know it)
                logs = list(safe.get("explainability_log") or [])
                synthetic = f"Step: {node_name}" + (f" for {completed_id}" if completed_id else "")
                logs.append(synthetic)

                # Optional: a structured activity object so the UI doesn’t need to regex the logs
                activity = {
                    "node": node_name,
                    "item_id": completed_id,         # may be None for in-flight steps
                    "status": "done" if completed_id else "working"
                }

                payload = {
                    "hypothesis_tree": safe.get("hypothesis_tree") or [],
                    "explainability_log": logs,
                    "last_completed_item_id": completed_id,
                    "activity": activity,            # <— new, harmless for old UIs
                }

                yield json.dumps(_to_jsonable(payload)) + "\n"

    except Exception as e:
        error_msg = f"Agent Runtime Error: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        yield json.dumps({
            "hypothesis_tree": [],
            "explainability_log": [error_msg],
            "activity": {"node": "error", "item_id": None, "status": "done"}
        }) + "\n"

@app.post("/run_agent")
async def run_agent(request: Request):
    """
    Production Endpoint: Triggers the real AI Agent.
    """
    body = await request.json()
    problem = body.get("problem_statement", "")
    
    if not problem:
        raise HTTPException(status_code=400, detail="Problem statement is required")
        
    print(f"\n[Server] Received Request: {problem}")
    return StreamingResponse(real_agent_generator(problem), media_type="application/x-ndjson")

# ============================================================
# MAIN EXECUTION
# ============================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    if agent_app:
        print("STARTING PRODUCTION AGENT SERVER")
        print("Endpoint: http://localhost:8000/run_agent")
    else:
        print("STARTING SERVER (WARNING: Agent Failed to Initialize)")
    print("="*60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)