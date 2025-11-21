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
from pydantic import BaseModel
from agent_helpers.cosmos_db import CosmosDB

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
    existing_tree = state.get("existing_tree")
    restart_node_id = state.get("restart_node_id")
    
    if existing_tree and restart_node_id:
        print(f"--- Restarting from node {restart_node_id} ---")
        
        # 1. Find the node to restart
        restart_node = next((n for n in existing_tree if n["id"] == restart_node_id), None)
        if not restart_node:
            print(f"Warning: Restart node {restart_node_id} not found. Starting fresh.")
            return {
                "hypothesis_tree": [],
                "analyses_needed": [],
                "nodes_to_process": [],
                "explainability_log": [f"Restart failed: Node not found. Starting fresh: {problem}"],
                "last_completed_item_id": None
            }
            
        # 2. Prune descendants
        # Simple BFS to find all descendants
        nodes_to_keep = [n for n in existing_tree if n["id"] != restart_node_id]
        descendants = set()
        queue = [restart_node_id]
        
        while queue:
            current = queue.pop(0)
            children = [n["id"] for n in existing_tree if n["parent_id"] == current]
            for child in children:
                descendants.add(child)
                queue.append(child)
        
        nodes_to_keep = [n for n in nodes_to_keep if n["id"] not in descendants]
        
        # 3. Reset the restart node's state
        restart_node["is_leaf"] = False
        # Add it back to the tree
        nodes_to_keep.append(restart_node)
        
        # 4. Create work item for this node
        # If it's root (id="1", "2"), it needs breakdown. If it was a leaf, it needs analyze?
        # Actually, if we edit text, we probably want to re-breakdown or re-classify.
        # Let's assume we want to breakdown again.
        action = "breakdown"
        if restart_node["parent_id"] == "0":
             # Roots are usually broken down
             action = "breakdown"
        else:
             # Mid-tree nodes are also broken down
             action = "breakdown"
             
        new_work_item = WorkItem(id=restart_node_id, action=action)
        
        return {
            "hypothesis_tree": nodes_to_keep,
            "analyses_needed": [],
            "nodes_to_process": [new_work_item],
            "explainability_log": [f"Restarting analysis from node {restart_node_id}: {restart_node['text'][:30]}..."],
            "last_completed_item_id": None
        }

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

def ensure_completion(state: AgentState) -> dict:
    """
    Safety net: Scans the tree for any non-leaf nodes that have no children
    and are not in the process queue. Adds them to the queue if found.
    """
    tree = state.get("hypothesis_tree", [])
    queue = state.get("nodes_to_process", [])
    queue_ids = {item["id"] for item in queue}
    
    new_work_items = []
    
    for node in tree:
        # Condition: Not a leaf, has no children, and not currently queued
        # Also check that children_ids is empty (not just missing)
        if not node["is_leaf"] and len(node.get("children_ids", [])) == 0 and node["id"] not in queue_ids:
            print(f"[Safety] Found orphaned node {node['id']}. Re-queueing.")
            
            # Determine action based on depth
            depth = len(node["id"].split('.'))
            
            action = "breakdown"
            if depth >= 2:
                action = "classify"
                
            new_work_items.append(WorkItem(id=node["id"], action=action))
            queue_ids.add(node["id"]) # Prevent duplicates in this pass
            
    if new_work_items:
        return {
            "nodes_to_process": new_work_items,
            "explainability_log": [f"Safety net: Re-queued {len(new_work_items)} orphaned nodes."]
        }
        
    # If no new work items, we're truly done
    return {}

def route_action(state: AgentState) -> str:
    if not state["nodes_to_process"]:
        return "ensure_completion"

    next_item = state["nodes_to_process"][0]
    next_action = next_item["action"]
    
    if next_action == "breakdown":
        return "breakdown_hypothesis"
    elif next_action == "classify":
        return "classify_hypothesis"
    
    return "ensure_completion"

def check_queue_after_ensure(state: AgentState) -> str:
    """Check if there's work to do after ensure_completion runs"""
    queue = state.get("nodes_to_process", [])
    
    if not queue:
        # No work in queue - we're done
        return "wait_for_approval"
    
    # There's work, route it
    next_item = queue[0]
    next_action = next_item["action"]
    
    if next_action == "breakdown":
        return "breakdown_hypothesis"
    elif next_action == "classify":
        return "classify_hypothesis"
    
    return "wait_for_approval"

def build_graph():
    if not agents:
        raise RuntimeError("Agents not initialized. Check logs for setup errors.")

    workflow = StateGraph(AgentState)
    
    workflow.add_node("start_process", start_process)
    workflow.add_node("formulate_top_hypothesis", agents["strategist"].formulate_top_hypothesis)
    workflow.add_node("breakdown_hypothesis", agents["strategist"].breakdown_hypothesis)
    workflow.add_node("classify_hypothesis", agents["researcher"].classify_hypothesis)
    workflow.add_node("ensure_completion", ensure_completion)
    workflow.add_node("wait_for_approval", wait_for_approval)
    workflow.add_node("compile_report", compile_report)

    workflow.set_entry_point("start_process")

    workflow.add_edge("start_process", "formulate_top_hypothesis")
    
    destinations = {
        "breakdown_hypothesis": "breakdown_hypothesis", 
        "classify_hypothesis": "classify_hypothesis", 
        "ensure_completion": "ensure_completion"
    }
    
    workflow.add_conditional_edges("formulate_top_hypothesis", route_action, destinations)
    workflow.add_conditional_edges("breakdown_hypothesis", route_action, destinations)
    workflow.add_conditional_edges("classify_hypothesis", route_action, destinations)

    # Edge from ensure_completion
    ensure_destinations = {
        "breakdown_hypothesis": "breakdown_hypothesis", 
        "classify_hypothesis": "classify_hypothesis", 
        "ensure_completion": "ensure_completion", # Should not happen if logic is correct, but safe
        "wait_for_approval": "wait_for_approval"
    }
    workflow.add_conditional_edges("ensure_completion", check_queue_after_ensure, ensure_destinations)

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

class AgentInput(BaseModel):
    problem_statement: str
    scratchpad_id: str = None
    existing_tree: list = None
    restart_node_id: str = None

async def real_agent_generator(input_data: AgentInput):
    if not agent_app:
        yield json.dumps({"explainability_log": ["Error: Agent not initialized (Check API Keys)."]}) + "\n"
        return

    inputs = {
        "problem_statement": input_data.problem_statement,
        "scratchpad_id": input_data.scratchpad_id,
        "existing_tree": input_data.existing_tree,
        "restart_node_id": input_data.restart_node_id
    }

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

# ============================================================
# AUTH & SCRATCHPAD ENDPOINTS
# ============================================================

class LoginRequest(BaseModel):
    username: str
    password: str

class ScratchpadRequest(BaseModel):
    user_id: str
    title: str

@app.post("/auth/register")
async def register(req: LoginRequest):
    user = CosmosDB().create_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=400, detail="User already exists")
    return user

@app.post("/auth/login")
async def login(req: LoginRequest):
    user = CosmosDB().get_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user

@app.get("/scratchpads/{user_id}")
async def get_scratchpads(user_id: str):
    return CosmosDB().get_scratchpads(user_id)

@app.post("/scratchpads")
async def create_scratchpad(req: ScratchpadRequest):
    return CosmosDB().create_scratchpad(req.user_id, req.title)

# ============================================================
# DOCUMENT ENDPOINTS
# ============================================================

@app.post("/scratchpads/{scratchpad_id}/documents")
async def upload_document(scratchpad_id: str, request: Request):
    """
    Upload a document to a scratchpad
    Expects: {"filename": "...", "content": "base64_encoded_bytes"}
    """
    from agent_helpers.document_processor import process_file
    import base64
    
    try:
        body = await request.json()
        filename = body.get("filename")
        content_b64 = body.get("content")
        
        if not filename or not content_b64:
            raise HTTPException(status_code=400, detail="Missing filename or content")
        
        # Decode base64 content
        file_bytes = base64.b64decode(content_b64)
        
        # Process document
        processed = process_file(file_bytes, filename)
        
        # Save document metadata and text
        doc = CosmosDB().save_document(
            scratchpad_id=scratchpad_id,
            filename=filename,
            text=processed.text,
            metadata=processed.metadata
        )
        
        if not doc:
            raise HTTPException(status_code=500, detail="Failed to save document")
        
        # Save vectorized chunks
        CosmosDB().save_document_chunks(
            scratchpad_id=scratchpad_id,
            document_id=doc["id"],
            filename=filename,
            chunks=processed.chunks
        )
        
        return {"success": True, "document": doc}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Document upload error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scratchpads/{scratchpad_id}/documents")
async def list_documents(scratchpad_id: str):
    """Get all documents for a scratchpad"""
    return CosmosDB().get_documents(scratchpad_id)

@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document"""
    success = CosmosDB().delete_document(document_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    return {"success": True}

@app.post("/run_agent")
async def run_agent(input_data: AgentInput):
    """
    Production Endpoint: Triggers the real AI Agent.
    """
    print(f"\n[Server] Received Request: {input_data.problem_statement[:50]}... (Pad: {input_data.scratchpad_id})")
    if input_data.restart_node_id:
        print(f"[Server] Restarting from node: {input_data.restart_node_id}")
        
    return StreamingResponse(real_agent_generator(input_data), media_type="application/x-ndjson")

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