from langchain_core.output_parsers import StrOutputParser
# --- FIXED IMPORTS ---
from .prompts import top_hypothesis_prompt, breakdown_prompt
from .types import AgentState, Hypothesis, WorkItem 
# ---

# --- Custom JSON Parser ---
import json
import re

def parse_json_from_string(text: str) -> dict:
    assistant_tag = "<|assistant|>"
    assistant_index = text.rfind(assistant_tag)
    search_text = text[assistant_index + len(assistant_tag):] if assistant_index != -1 else text

    json_match = re.search(r"```json\s*(\{.*?\})\s*```|(\{.*?\})", search_text, re.DOTALL)
    
    if json_match:
        json_str = json_match.group(1) or json_match.group(2)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"--- JSONDecodeError ---")
            print(f"Could not parse: {json_str}")
            print(f"Error: {e}")
            return {"error": "Failed to parse JSON", "raw_text": text}
    else:
        print(f"--- No valid JSON object found after <|assistant|> tag ---")
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
        
        # --- FIXED BUGS ---
        # 1. Add the next job to the to-do list
        new_work_item = WorkItem(id="1", action="breakdown")
        
        return {
            "hypothesis_tree": [top_hypothesis],
            "explainability_log": [log_entry],
            "nodes_to_process": [new_work_item], # <-- ADDED
            "last_completed_item_id": "1"       # <-- ADDED
        }
        # --- END FIX ---

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
                "explainability_log": [log_entry]
            }

        sub_hypotheses_list = response.get("sub_hypotheses", [])
        reasoning = response.get("reasoning", "No reasoning provided")
        
        log_entry = f"Broke down hypothesis ({parent_id}) '{parent_text}'. Reasoning: {reasoning}"
        
        new_nodes = []
        new_work_items = []
        
        for i, sub_h in enumerate(sub_hypotheses_list):
            node_id = f"{parent_id}.{i+1}"
            node_text = sub_h.get("text", "No text provided")
            
            new_node = Hypothesis(
                id=node_id,
                parent_id=parent_id,
                text=node_text,
                reasoning=reasoning,
                is_leaf=False
            )
            new_nodes.append(new_node)
            new_work_items.append(WorkItem(id=node_id, action="classify"))
            log_entry += f"\n  - Created ({node_id}): '{node_text}'"

        # --- FIXED BUG ---
        return {
            "hypothesis_tree": state["hypothesis_tree"] + new_nodes,
            "nodes_to_process": remaining_nodes_to_process + new_work_items,
            "explainability_log": [log_entry],
            "last_completed_item_id": parent_id # <-- ADDED
        }
        # --- END FIX ---