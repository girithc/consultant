from agent_helpers.strat import parse_json_from_string
from langchain_core.output_parsers import StrOutputParser
from .prompts import classifier_prompt, analysis_prompt, source_prompt
from agent_helpers.tools import VectorStore, simulated_web_search
from agent_helpers.types import AgentState, Analysis, WorkItem # Import types from main
from agent_helpers.functions import print_tree 


# --- Custom JSON Parser (copied from old file) ---
import json
import re


# --- Research Agent ---

class ResearchAgent:
    def __init__(self, llm, vector_store, web_search_tool):
        self.llm = llm
        self.vector_store = vector_store
        self.web_search_tool = web_search_tool
        print("Research Agent (Analyst) initialized.")

    def get_llm_chain(self, prompt_template):
        """Helper to create a chain for this agent."""
        return prompt_template | self.llm | StrOutputParser() | parse_json_from_string

    def gather_context(self, query: str) -> str:
        """
        Gathers context from all available tools (RAG, Web)
        """
        print(f"[ResearchAgent] Gathering context for query: '{query[:50]}...'")
        
        # 1. Search the agent's memory (Vector Store)
        memory_results = self.vector_store.search(query)
        
        # 2. Search the web
        web_results = self.web_search_tool(query)
        
        context = f"""
        --- Context from Agent Memory (Learnings & Docs) ---
        {memory_results}
        
        --- Context from Live Web Search ---
        {web_results}
        """
        return context

    def classify_hypothesis(self, state: AgentState) -> dict:
        """Classifies a hypothesis as 'leaf' or 'branch' using RAG."""
        print("\n--- Executing Node: classify_hypothesis (ResearchAgent) ---")
        
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes_to_process = state["nodes_to_process"][1:]
        node_id = item_to_process["id"]
        
        node = next(h for h in state["hypothesis_tree"] if h["id"] == node_id)
        node_text = node["text"]
        
        # --- Tool Use ---
        context = self.gather_context(node_text)
        # ---
        
        chain = self.get_llm_chain(classifier_prompt)
        
        print(f"... Analyst is reasoning (LLM Call for {node_id}) ...")
        response = chain.invoke({"hypothesis_text": node_text, "context": context})
        
        if "error" in response:
            log_entry = f"Error classifying hypothesis {node_id}: {response.get('raw_text', 'Unknown error')}"
            print(log_entry)
            return {
                "nodes_to_process": remaining_nodes_to_process,
                "explainability_log": [log_entry]
            }

        classification = response.get("classification", "branch")
        reasoning = response.get("reasoning", "No reasoning provided")
        
        log_entry = f"Classified hypothesis ({node_id}) '{node_text}' as '{classification}'. Reasoning: {reasoning}"
        
        new_work_item = None
        
        if classification == "leaf":
            node["is_leaf"] = True
            new_work_item = WorkItem(id=node_id, action="analyze")
        else:
            new_work_item = WorkItem(id=node_id, action="breakdown")
            
        updated_tree = [h if h["id"] != node_id else node for h in state["hypothesis_tree"]]
        
        new_nodes_to_process = remaining_nodes_to_process
        if new_work_item:
            new_nodes_to_process = remaining_nodes_to_process + [new_work_item]
            
        # This is the item to be reviewed by the user
        state["last_completed_item_id"] = node_id
        
        updated_tree = [h if h["id"] != node_id else node for h in state["hypothesis_tree"]]

# Call the new print function
        print_tree(updated_tree, title="HYPOTHESIS TREE - UPDATED CLASSIFICATION")

        return {
            "hypothesis_tree": updated_tree,
            "nodes_to_process": new_nodes_to_process,
            "explainability_log": [log_entry],
            "last_completed_item_id": node_id
        }

    def identify_analysis(self, state: AgentState) -> dict:
        """Identifies the analysis and data source needed for a leaf node."""
        print("\n--- Executing Node: identify_analysis (ResearchAgent) ---")
        
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes_to_process = state["nodes_to_process"][1:]
        node_id = item_to_process["id"]
        
        node = next(h for h in state["hypothesis_tree"] if h["id"] == node_id)
        node_text = node["text"]
        
        # --- Tool Use (Step 1: Analysis) ---
        context = self.gather_context(node_text)
        # ---
        
        analysis_chain = self.get_llm_chain(analysis_prompt)
        
        print(f"... Analyst is reasoning (LLM Call for analysis of {node_id}) ...")
        analysis_response = analysis_chain.invoke({"hypothesis_text": node_text, "context": context})
        
        if "error" in analysis_response:
            log_entry = f"Error identifying analysis for {node_id}: {analysis_response.get('raw_text', 'Unknown error')}"
            print(log_entry)
            return {
                "nodes_to_process": remaining_nodes_to_process,
                "explainability_log": [log_entry]
            }

        analysis_required = analysis_response.get("analysis_required", "No analysis identified")
        analysis_reasoning = analysis_response.get("reasoning", "No reasoning provided")
        log_entry = f"Identified analysis for leaf ({node_id}): '{analysis_required}'. Reasoning: {analysis_reasoning}"
        
        # --- Tool Use (Step 2: Source) ---
        # We re-gather context, this time for the *analysis*
        source_context = self.gather_context(analysis_required)
        # ---
        
        source_chain = self.get_llm_chain(source_prompt)
        print(f"... Analyst is reasoning (LLM Call for source of {node_id}) ...")
        source_response = source_chain.invoke({"analysis_required": analysis_required, "context": source_context})
        
        if "error" in source_response:
            log_entry += f"\n  - Error identifying source: {source_response.get('raw_text', 'Unknown error')}"
            print(log_entry)
            # Continue, but with a partial analysis
            source_of_reference = "Error: No source identified"
            source_reasoning = source_response.get('raw_text', 'Unknown error')
        else:
            source_of_reference = source_response.get("source", "No source identified")
            source_reasoning = source_response.get("reasoning", "No reasoning provided")
            log_entry += f"\n  - Identified source for analysis: '{source_of_reference}'. Reasoning: {source_reasoning}"
        
        new_analysis = Analysis(
            hypothesis_id=node_id,
            analysis_required=analysis_required,
            analysis_reasoning=analysis_reasoning,
            source_of_reference=source_of_reference,
            source_reasoning=source_reasoning
        )
        
        # This is the item to be reviewed by the user
        state["last_completed_item_id"] = node_id
        
        return {
            "analyses_needed": state["analyses_needed"] + [new_analysis],
            "nodes_to_process": remaining_nodes_to_process,
            "explainability_log": [log_entry]
        }