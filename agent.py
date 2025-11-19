import warnings
warnings.filterwarnings("ignore") # Suppress all library warnings

import json
import re
import traceback
from typing import TypedDict, List, Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_huggingface import HuggingFacePipeline
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch
from langgraph.graph import StateGraph, END

# --- Local Imports ---
from agent_helpers.tools import VectorStore, simulated_web_search
from agent_helpers.types import AgentState, Hypothesis, WorkItem
from agent_helpers.functions import print_tree 
from agent_helpers.research import ResearchAgent
from agent_helpers.strat import StrategistAgent

# --- LLM Setup ---
def load_llm():
    """Loads the Hugging Face model and pipeline."""
    try:
        model_id = "Qwen/Qwen3-4B-Instruct-2507"
        print(f"Loading {model_id}...")
        
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"Using device: {device}")

        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

        if device == "mps":
            model_dtype = torch.float16
        else:
            model_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float32
        
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=model_dtype,
            device_map=None,
            trust_remote_code=True,
            low_cpu_mem_usage=True
        )
        
        model = model.to(device)
        model.eval()

        hf_pipeline = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=512,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            repetition_penalty=1.1
        )

        llm = HuggingFacePipeline(pipeline=hf_pipeline)
        print("Qwen3-4B model loaded successfully.")
        return llm

    except Exception as e:
        print(f"Error loading model: {e}")
        traceback.print_exc()
        return None

# --- Global Dictionaries ---
agent_tools = {}
agents = {}

# --- Graph Nodes ---

def start_process(state: AgentState) -> dict:
    problem = state["problem_statement"]
    # print(f"Problem statement defined: {problem}") # Optional: comment out to reduce noise
    return {
        "hypothesis_tree": [],
        "analyses_needed": [],
        "nodes_to_process": [],
        "explainability_log": [f"Problem statement defined: {problem}"],
        "last_completed_item_id": None
    }

def compile_report(state: AgentState):
    print("\n--- Executing Node: compile_report ---")
    print("\n\n--- McKinsey Agent Run Complete ---")
    
    print_tree(state["hypothesis_tree"], title="FINAL HYPOTHESIS TREE (3 LEVELS)")
    
    print("\n--- Analyses Required (for LEAF nodes) ---")
    if state["analyses_needed"]:
        for analysis in state["analyses_needed"]:
            print(f"\n* For Hypothesis ({analysis['hypothesis_id']}):")
            print(f"  - Analysis: {analysis['analysis_required']}")
            print(f"  - Source: {analysis['source_of_reference']}")
    else:
        print("No analyses identified.")
        
    print("\n--- End of Report ---")
    return {}

# --- Routing Logic ---

def route_action(state: AgentState) -> str:
    if not state["nodes_to_process"]:
        return "compile_report"

    next_item = state["nodes_to_process"][0]
    next_action = next_item["action"]
    node_id = next_item["id"]
    depth = len(node_id.split('.'))
    
    # Prioritize Breakdown for levels 1 & 2
    if depth <= 2 and next_action == "breakdown":
        print(f"\n[Router] -> BREAKDOWN {node_id} (Depth {depth}) to reach Level 3.")
        return "breakdown_hypothesis"
        
    # At Level 3, force classification/analysis
    if depth == 3:
        if next_action == "breakdown":
             state["nodes_to_process"][0] = WorkItem(id=node_id, action="classify")
             return "classify_hypothesis"
        elif next_action == "classify":
            return "classify_hypothesis"
        elif next_action == "analyze":
            return "identify_analysis"

    # Default routing
    if next_action == "classify":
        return "classify_hypothesis"
    elif next_action == "analyze":
        return "identify_analysis"
    
    return "compile_report"

# --- Build Graph ---
def build_graph():
    workflow = StateGraph(AgentState)
    workflow.add_node("start_process", start_process)
    workflow.add_node("formulate_top_hypothesis", agents["strategist"].formulate_top_hypothesis)
    workflow.add_node("breakdown_hypothesis", agents["strategist"].breakdown_hypothesis)
    workflow.add_node("classify_hypothesis", agents["researcher"].classify_hypothesis)
    workflow.add_node("identify_analysis", agents["researcher"].identify_analysis)
    workflow.add_node("compile_report", compile_report)

    workflow.set_entry_point("start_process")

    workflow.add_edge("start_process", "formulate_top_hypothesis")
    
    # Route after every step
    workflow.add_conditional_edges("formulate_top_hypothesis", route_action, 
        {"breakdown_hypothesis": "breakdown_hypothesis", "classify_hypothesis": "classify_hypothesis", "identify_analysis": "identify_analysis", "compile_report": "compile_report"})
    workflow.add_conditional_edges("breakdown_hypothesis", route_action, 
        {"breakdown_hypothesis": "breakdown_hypothesis", "classify_hypothesis": "classify_hypothesis", "identify_analysis": "identify_analysis", "compile_report": "compile_report"})
    workflow.add_conditional_edges("classify_hypothesis", route_action, 
        {"breakdown_hypothesis": "breakdown_hypothesis", "classify_hypothesis": "classify_hypothesis", "identify_analysis": "identify_analysis", "compile_report": "compile_report"})
    workflow.add_conditional_edges("identify_analysis", route_action, 
        {"breakdown_hypothesis": "breakdown_hypothesis", "classify_hypothesis": "classify_hypothesis", "identify_analysis": "identify_analysis", "compile_report": "compile_report"})

    workflow.add_edge("compile_report", END)
    return workflow.compile()

# --- Main Execution ---
if __name__ == "__main__":
    llm = load_llm()
    
    if llm is None:
        print("\nCannot run agent. LLM failed to load.")
    else:
        agent_tools["vector_store"] = VectorStore()
        agent_tools["web_search"] = simulated_web_search
        
        agents["strategist"] = StrategistAgent(llm)
        agents["researcher"] = ResearchAgent(llm, agent_tools["vector_store"], agent_tools["web_search"])
        
        app = build_graph()
        
        print("\nStarting Automated McKinsey Agent run...")
        
        # --- USER INPUT RESTORED ---
        default_problem = "A leading e-commerce client has seen a 15% decline in profits over the last quarter, despite a 5% increase in revenue."
        
        print("\n" + "="*60)
        print("Please enter the client problem statement.")
        print(f"Press [Enter] to use the default:\n'{default_problem}'")
        print("="*60)
        
        user_input = input("Problem Statement: ").strip()
        problem_statement = user_input if user_input else default_problem
        
        print(f"\nProblem Statement: '{problem_statement}'")
        
        print("\n" + "#"*60)
        print("# STARTING AUTOMATED EXECUTION")
        print("#"*60)
        
        try:
            inputs = {"problem_statement": problem_statement}
            final_state = app.invoke(inputs, config={"recursion_limit": 50})
        except Exception as e:
            print(f"\n--- GRAPH EXECUTION FAILED ---")
            print(f"Error: {e}")
            final_state = None
            
        if final_state:
            compile_report(final_state)