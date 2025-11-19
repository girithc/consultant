from langchain_core.output_parsers import StrOutputParser
# --- FIXED IMPORTS ---
from .prompts import top_hypothesis_prompt, breakdown_prompt
from .types import AgentState, Hypothesis, WorkItem 
# ---

# --- Import for Automated Printing (Must be available in agent_helpers.agent) ---
# NOTE: This import assumes the print_tree function is defined in agent.py and 
# is accessible for import.
from agent_helpers.functions import print_tree 
# ---

# --- Custom JSON Parser (Same as original) ---
import json
import re

# Updated parse_json_from_string function (in strat.py and research.py)

def parse_json_from_string(text: str) -> dict:
    # 1. Strip the common Qwen/Instruct tags to isolate the final response
    search_text = text.rfind("<|assistant|>")
    if search_text != -1:
        search_text = text[search_text + len("<|assistant|>"):]
    else:
        search_text = text

    # 2. Aggressively search for a JSON structure (either wrapped in ```json or bare)
    # The regex targets the innermost JSON or the largest JSON block.
    json_match = re.search(r"```json\s*(\{.*?\})\s*```|(\{.*?\})", search_text, re.DOTALL)
    
    if json_match:
        json_str = json_match.group(1) or json_match.group(2)
        try:
            # 3. Clean up the string slightly before loading (e.g., stripping whitespace)
            return json.loads(json_str.strip())
        except json.JSONDecodeError as e:
            # Print a clean error message, not the entire prompt dump
            print(f"--- JSONDecodeError ---")
            print(f"Failed to parse JSON (start of string): {json_str[:200]}...")
            print(f"Error: {e}")
            return {"error": "Failed to parse JSON", "raw_text": text}
    else:
        print(f"--- No valid JSON object found ---")
        return {"error": "No JSON object found", "raw_text": text}
# --- Strategist Agent ---

class StrategistAgent:
    def __init__(self, llm):
        self.llm = llm
        print("Strategist Agent (Partner) initialized.")

    def get_llm_chain(self, prompt_template):
        """Helper to create a chain for this agent."""
        return prompt_template | self.llm | StrOutputParser() | parse_json_from_string

    def formulate_top_hypothesis(self, state: AgentState) -> dict:
        """Generates the single, top-level hypothesis."""
        print("\n--- Executing Node: formulate_top_hypothesis (Strategist) ---")
        problem = state["problem_statement"]
        chain = self.get_llm_chain(top_hypothesis_prompt)
        
        print("... Strategist is thinking (LLM Call) ...")
        # Note: 'context' is not passed here as the Strategist is pure reasoning
        response = chain.invoke({"problem": problem}) 
        
        if "error" in response:
            log_entry = f"Error formulating top hypothesis: {response.get('raw_text', 'Unknown error')}"
            print(log_entry)
            return {"explainability_log": [log_entry]}

        hypothesis_text = response.get("hypothesis_text", "No hypothesis text found")
        reasoning = response.get("reasoning", "No reasoning provided")
        
        top_hypothesis = Hypothesis(
            id="1",
            parent_id="0",
            text=hypothesis_text,
            reasoning=reasoning,
            is_leaf=False
        )
        
        log_entry = f"Formulated top hypothesis (1): '{hypothesis_text}'. Reasoning: {reasoning}"
        
        # 1. Add the next job to the to-do list
        new_work_item = WorkItem(id="1", action="breakdown")
        
        # --- NEW: Print Tree after Level 1 is formulated ---
        print_tree([top_hypothesis], title="HYPOTHESIS TREE - LEVEL 1 FORMULATED")
        # --- END NEW ---
        
        return {
            "hypothesis_tree": [top_hypothesis],
            "explainability_log": [log_entry],
            "nodes_to_process": [new_work_item],
            "last_completed_item_id": "1"
        }

    def breakdown_hypothesis(self, state: AgentState) -> dict:
        """Takes one hypothesis from the 'to_breakdown' queue and breaks it down."""
        print("\n--- Executing Node: breakdown_hypothesis (Strategist) ---")
        
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes_to_process = state["nodes_to_process"][1:]
        parent_id = item_to_process["id"]
        
        parent_hypothesis = next(h for h in state["hypothesis_tree"] if h["id"] == parent_id)
        parent_text = parent_hypothesis["text"]
        
        chain = self.get_llm_chain(breakdown_prompt)
        
        print(f"... Strategist is thinking (LLM Call for {parent_id}) ...")
        # Note: 'context' is not passed here
        response = chain.invoke({"hypothesis_text": parent_text})
        
        if "error" in response:
            log_entry = f"Error breaking down hypothesis {parent_id}: {response.get('raw_text', 'Unknown error')}"
            print(log_entry)
            return {
                "nodes_to_process": remaining_nodes_to_process, # Remove failed item
                "explainability_log": [log_entry],
                "last_completed_item_id": parent_id # Still track completion
            }

        sub_hypotheses_list = response.get("sub_hypotheses", [])
        reasoning = response.get("reasoning", "No reasoning provided")
        
        log_entry = f"Broke down hypothesis ({parent_id}) '{parent_text}'. Reasoning: {reasoning}"
        
        new_nodes = []
        new_work_items = []
        
        # Determine the next index based on the number of existing children
        existing_children = [h for h in state["hypothesis_tree"] if h["parent_id"] == parent_id]
        next_index = len(existing_children) + 1
        
        for i, sub_h in enumerate(sub_hypotheses_list):
            node_id = f"{parent_id}.{i + next_index}" # Use the calculated starting index
            node_text = sub_h.get("text", "No text provided")
            
            new_node = Hypothesis(
                id=node_id,
                parent_id=parent_id,
                text=node_text,
                reasoning=reasoning,
                is_leaf=False
            )
            new_nodes.append(new_node)
            # All new nodes start with 'breakdown' to ensure depth is achieved
            new_work_items.append(WorkItem(id=node_id, action="breakdown")) 
            log_entry += f"\n  - Created ({node_id}): '{node_text}'"

        new_tree = state["hypothesis_tree"] + new_nodes
        
        # --- NEW: Print Tree after breakdown is complete ---
        print_tree(new_tree, title=f"HYPOTHESIS TREE - BREAKDOWN OF {parent_id}")
        # --- END NEW ---
        
        return {
            "hypothesis_tree": new_tree,
            # Prepend new work items to the remaining list for Depth-First expansion
            "nodes_to_process": new_work_items + remaining_nodes_to_process, 
            "explainability_log": [log_entry],
            "last_completed_item_id": parent_id 
        }