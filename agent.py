import json
import re
from typing import TypedDict, List, Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_huggingface import HuggingFacePipeline
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch
from langgraph.graph import StateGraph, END

from agent_helpers.tools import VectorStore, simulated_web_search
from agent_helpers.types import AgentState
from agent_helpers.research import ResearchAgent
from agent_helpers.strat import StrategistAgent

# --- Local Imports ---

# --- LLM Setup ---

def load_llm():
    """Loads the Hugging Face model and pipeline."""
    try:
        model_id = "microsoft/Phi-3-mini-4k-instruct"
        print(f"Loading {model_id}...")
        
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"Using device: {device}")

        tokenizer = AutoTokenizer.from_pretrained(model_id)

        model_dtype = torch.float32 if device == "mps" else torch.float16
        
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=model_dtype,
            device_map="auto" if device == "cpu" else None,
            trust_remote_code=True
        ).to(device if device == "mps" else "auto")

        hf_pipeline = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=1024,
            temperature=None,
        )

        llm = HuggingFacePipeline(pipeline=hf_pipeline)
        print("Hugging Face model loaded successfully.")
        return llm

    except Exception as e:
        print(f"Error loading model from Hugging Face: {e}")
        return None

# --- Graph Nodes (Main Control Flow) ---

def start_process(state: AgentState) -> dict:
    """Entry point. Initializes the state."""
    problem = state["problem_statement"]
    log_entry = f"Problem statement defined: {problem}"
    
    return {
        "hypothesis_tree": [],
        "analyses_needed": [],
        "nodes_to_process": [],
        "explainability_log": [log_entry],
        "last_completed_item_id": None
    }

def get_user_review(state: AgentState) -> dict:
    """
    NEW "Self-Healing" node.
    Pauses after every agent action to ask for user feedback.
    """
    print("\n--- AGENT PAUSED: Waiting for Review ---")
    
    last_item_id = state.get("last_completed_item_id")
    if not last_item_id:
        print("No action to review. Proceeding.")
        return {} # No change to state

    # Find the item that was just processed
    last_node = next((h for h in state["hypothesis_tree"] if h["id"] == last_item_id), None)
    
    if not last_node:
        print(f"Error: Could not find last_node with id {last_item_id} to review.")
        return {}

    print("-" * 30)
    print(f"Agent just processed item: ({last_node['id']}) {last_node['text']}")
    print(f"Agent's Reasoning: {last_node['reasoning']}")
    
    # Check if an analysis was just added for this node
    last_analysis = next((a for a in state["analyses_needed"] if a["hypothesis_id"] == last_item_id), None)
    if last_analysis:
        print(f"Analysis Required: {last_analysis['analysis_required']}")
        print(f"Source of Reference: {last_analysis['source_of_reference']}")
        print(f"Source Reasoning: {last_analysis['source_reasoning']}")

    print("-" * 30)
    print("Please review the agent's work:")
    print("  [A]ccept and Continue")
    print("  [C]orrect and Teach the agent")
    
    while True:
        choice = input("Your choice (A/C): ").strip().upper()
        if choice == 'A':
            print("--- User accepted. Continuing. ---")
            return {} # No change, just proceed
        
        elif choice == 'C':
            print("--- User wants to correct. ---")
            
            # 1. Get the Correction
            print("What is your correction or added context? (e.g., 'This reasoning is wrong, the real issue is X', 'The source should be Y')")
            correction_text = input("Your correction: ")
            
            # 2. Apply "Lasting Change": Add to VectorStore
            # We access the vector_store via the 'global' agent_tools dict
            try:
                agent_tools["vector_store"].add_learning(f"USER CORRECTION for Hypothesis '{last_node['text']}': {correction_text}")
                log_entry = f"User provided correction for node ({last_item_id}). Learning saved."
            except Exception as e:
                print(f"Error saving learning: {e}")
                log_entry = f"Error saving user correction for node ({last_item_id}): {e}"

            # 3. Apply "Immediate Fix": Ask user if they want to update the node text/reasoning
            print("Do you want to update the hypothesis or analysis now? (y/n)")
            if input().strip().lower() == 'y':
                print("What is the new text for the hypothesis? (press Enter to skip)")
                new_text = input()
                if new_text:
                    last_node["text"] = new_text
                
                print("What is the new reasoning? (press Enter to skip)")
                new_reasoning = input()
                if new_reasoning:
                    last_node["reasoning"] = new_reasoning
                
                # Update the node in the tree
                updated_tree = [h if h["id"] != last_item_id else last_node for h in state["hypothesis_tree"]]
                log_entry += "\nUser updated node text/reasoning in the current state."
                
                return {
                    "hypothesis_tree": updated_tree,
                    "explainability_log": [log_entry]
                }

            return {"explainability_log": [log_entry]}
        else:
            print("Invalid choice. Please enter 'A' or 'C'.")

def get_user_selection(state: AgentState) -> dict:
    """
    Stops the agent and asks the user to select the *next* node to process.
    """
    print("\n--- AGENT PAUSED: Waiting for Next Task ---")
    
    work_items = state["nodes_to_process"]
    if not work_items:
        print("No further actions available.")
        return {"nodes_to_process": []} # Will be routed to compile_report

    tree = state["hypothesis_tree"]
    
    print("Please select the next hypothesis to explore:")
    print("-" * 30)
    for i, item in enumerate(work_items):
        node = next((h for h in tree if h["id"] == item["id"]), None)
        if node:
            print(f"  {i+1}) [ID: {item['id']}] [Action: {item['action']}]")
            print(f"     Text: {node['text']}")
        
    print(f"  {len(work_items) + 1}) Finish and Compile Report")
    print("-" * 30)
    
    while True:
        try:
            choice_str = input(f"Enter your choice (1-{len(work_items) + 1}): ")
            choice = int(choice_str)
            
            if 1 <= choice <= len(work_items):
                selected_item = work_items[choice - 1]
                remaining_items = [item for item in work_items if item["id"] != selected_item["id"]]
                reordered_nodes_to_process = [selected_item] + remaining_items
                
                print(f"--- User selected: [ID: {selected_item['id']}] [Action: {selected_item['action']}] ---")
                return {"nodes_to_process": reordered_nodes_to_process}
                
            elif choice == len(work_items) + 1:
                print("--- User selected: Finish and Compile Report ---")
                return {"nodes_to_process": []} # Empty the list
            else:
                print(f"Invalid choice.")
        except ValueError:
            print("Invalid input. Please enter a number.")

def compile_report(state: AgentState):
    """Final node. Compiles and prints the full report."""
    print("\n--- Executing Node: compile_report ---")
    print("\n\n--- McKinsey Agent Run Complete ---")
    
    tree = state["hypothesis_tree"]
    def print_node(node_id, indent=""):
        node = next((h for h in tree if h["id"] == node_id), None)
        if not node: return
        leaf_marker = " (LEAF)" if node["is_leaf"] else ""
        print(f"{indent}- ({node['id']}) {node['text']}{leaf_marker}")
        children = [h for h in tree if h["parent_id"] == node_id]
        for child in children:
            print_node(child["id"], indent + "  ")
            
    print("\n--- Final Hypothesis Tree ---")
    print_node("1")
    
    print("\n--- Analyses Required (for LEAF nodes) ---")
    for analysis in state["analyses_needed"]:
        print(f"\n* For Hypothesis ({analysis['hypothesis_id']}):")
        print(f"  - Analysis: {analysis['analysis_required']}")
        print(f"  - Source: {analysis['source_of_reference']}")

    print("\n--- Full XAI Explainability Log ---")
    for i, log in enumerate(state["explainability_log"]):
        print(f"\n[Step {i}]")
        print(log)
        
    print("\n--- End of Report ---")
    return {}

# --- Conditional Edges ---

def route_action(state: AgentState) -> str:
    """
    This is the new "brain" of the agent.
    It reads the *first* item in the to-do list (which the user just picked)
    and routes to the correct node.
    """
    if not state["nodes_to_process"]:
        return "compile_report"
    
    next_action = state["nodes_to_process"][0]["action"]
    
    if next_action == "breakdown":
        return "breakdown_hypothesis"
    elif next_action == "classify":
        return "classify_hypothesis"
    elif next_action == "analyze":
        return "identify_analysis"
    else:
        print(f"Error: Unknown action '{next_action}'.")
        return "compile_report"

# --- Global Dictionaries for Agents and Tools ---
# This allows the 'get_user_review' node to access the vector store
agent_tools = {}
agents = {}

# --- Build the Graph ---
def build_graph():
    
    workflow = StateGraph(AgentState)

    # Add the nodes
    workflow.add_node("start_process", start_process)
    workflow.add_node("formulate_top_hypothesis", agents["strategist"].formulate_top_hypothesis)
    workflow.add_node("breakdown_hypothesis", agents["strategist"].breakdown_hypothesis)
    workflow.add_node("classify_hypothesis", agents["researcher"].classify_hypothesis)
    workflow.add_node("identify_analysis", agents["researcher"].identify_analysis)
    
    # Add the new human-in-the-loop nodes
    workflow.add_node("get_user_review", get_user_review)
    workflow.add_node("get_user_selection", get_user_selection)
    
    workflow.add_node("compile_report", compile_report)

    # Set the entry point
    workflow.set_entry_point("start_process")

    # --- NEW GRAPH FLOW ---
    # 1. Start -> Formulate
    workflow.add_edge("start_process", "formulate_top_hypothesis")
    
    # 2. After ANY action, go to REVIEW
    workflow.add_edge("formulate_top_hypothesis", "get_user_review")
    workflow.add_edge("breakdown_hypothesis", "get_user_review")
    workflow.add_edge("classify_hypothesis", "get_user_review")
    workflow.add_edge("identify_analysis", "get_user_review")

    # 3. After REVIEW, go to SELECT next task
    workflow.add_edge("get_user_review", "get_user_selection")

    # 4. After SELECT, route to the correct action
    workflow.add_conditional_edges(
        "get_user_selection",
        route_action,
        {
            "breakdown_hypothesis": "breakdown_hypothesis",
            "classify_hypothesis": "classify_hypothesis",
            "identify_analysis": "identify_analysis",
            "compile_report": "compile_report"
        }
    )

    # 5. Final node
    workflow.add_edge("compile_report", END)

    # Compile the graph
    return workflow.compile()

# --- Run the Agent ---
if __name__ == "__main__":
    
    llm = load_llm()
    
    if llm is None:
        print("\nCannot run agent. LLM failed to load.")
    else:
        # Initialize Tools
        agent_tools["vector_store"] = VectorStore()
        agent_tools["web_search"] = simulated_web_search
        
        # Initialize Agents
        agents["strategist"] = StrategistAgent(llm)
        agents["researcher"] = ResearchAgent(llm, agent_tools["vector_store"], agent_tools["web_search"])
        
        # Build the graph
        app = build_graph()
        
        print("\nStarting McKinsey Agent run...")
        
        # --- User Input Logic ---
        default_problem = "A leading e-commerce client has seen a 15% decline in profits over the last quarter, despite a 5% increase in revenue."
        
        print("\n" + "="*60)
        print("Please enter the client problem statement.")
        print(f"Press [Enter] to use the default:\n'{default_problem}'")
        print("="*60)
        
        user_input = input("Problem Statement: ").strip()
        
        if not user_input:
            print("Using default problem statement...")
            problem_statement = default_problem
        else:
            problem_statement = user_input
            
        inputs = {"problem_statement": problem_statement}
        
        # Stream the execution
        for s in app.stream(inputs, config={"recursion_limit": 50}):
            node_name = list(s.keys())[0]
            node_output = s[node_name]
            
            print(f"\n--- Node Finished: {node_name} ---")
            
            # Print XAI log
            if node_name not in ["get_user_review", "get_user_selection"] and isinstance(node_output, dict) and "explainability_log" in node_output:
                print("XAI Log:")
                print(node_output["explainability_log"][-1])