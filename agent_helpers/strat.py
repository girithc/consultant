from langchain_core.output_parsers import StrOutputParser
from .prompts import top_hypothesis_prompt, breakdown_prompt
from .types import AgentState, Hypothesis, WorkItem 
from agent_helpers.types import print_tree 
import json
import re

def parse_json_from_string(text: str) -> dict:
    # Robust JSON Parsing
    markdown_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if markdown_match:
        try: return json.loads(markdown_match.group(1))
        except: pass
    matches = list(re.finditer(r"\{.*\}", text, re.DOTALL))
    if matches:
        for match in reversed(matches):
            try: return json.loads(match.group(0))
            except: continue
    return {"error": "Failed to parse JSON", "raw_text": text}

class StrategistAgent:
    # CHANGE: Accept web_search_tool in init
    def __init__(self, llm, web_search_tool):
        self.llm = llm
        self.web_search = web_search_tool # Store the tool

    def get_llm_chain(self, prompt_template):
        return prompt_template | self.llm | StrOutputParser() | parse_json_from_string

    def formulate_top_hypothesis(self, state: AgentState) -> dict:
        print("\n--- Executing Node: formulate_top_hypothesis ---")
        problem = state["problem_statement"]
        
        # 1. RESEARCH FIRST
        print(f"   [Strategist] Researching problem context: '{problem[:30]}...'")
        context = self.web_search(problem)
        
        # 2. THEN FORMULATE
        chain = self.get_llm_chain(top_hypothesis_prompt)
        response = chain.invoke({"problem": problem, "context": context})
        
        hypotheses_list = response.get("hypotheses", [])
        if isinstance(hypotheses_list, dict): hypotheses_list = [hypotheses_list]

        new_nodes = []
        new_work_items = []
        
        for i, h_data in enumerate(hypotheses_list[:2]): 
            node_id = str(i + 1)
            new_nodes.append(Hypothesis(
                id=node_id, 
                parent_id="0", 
                text=h_data.get("text", "No text"), 
                reasoning=h_data.get("reasoning", ""), 
                is_leaf=False
            ))
            new_work_items.append(WorkItem(id=node_id, action="breakdown"))

        print_tree(new_nodes, title="INITIAL HYPOTHESES (DATA-DRIVEN)")
        
        return {
            "hypothesis_tree": new_nodes,
            "nodes_to_process": new_work_items,
            "explainability_log": [f"Formulated roots based on search data."]
        }

    def breakdown_hypothesis(self, state: AgentState) -> dict:
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes = state["nodes_to_process"][1:]
        parent_id = item_to_process["id"]
        
        parent_node = next(h for h in state["hypothesis_tree"] if h["id"] == parent_id)
        print(f"\n--- Executing Node: breakdown_hypothesis for {parent_id} ---")
        
        # 1. RESEARCH FIRST
        print(f"   [Strategist] Researching context for: '{parent_node['text'][:40]}...'")
        context = self.web_search(parent_node["text"])
        
        # 2. THEN BREAKDOWN
        chain = self.get_llm_chain(breakdown_prompt)
        response = chain.invoke({"hypothesis_text": parent_node["text"], "context": context})
        
        if "error" in response:
            return {"nodes_to_process": remaining_nodes}

        sub_hypotheses = response.get("sub_hypotheses", [])[:2]
        
        new_nodes = []
        new_work_items = []
        
        existing_kids = [h for h in state["hypothesis_tree"] if h["parent_id"] == parent_id]
        start_index = len(existing_kids) + 1

        for i, sub in enumerate(sub_hypotheses):
            child_id = f"{parent_id}.{start_index + i}"
            depth = len(child_id.split('.'))
            next_action = "classify" if depth >= 2 else "breakdown"

            new_nodes.append(Hypothesis(
                id=child_id,
                parent_id=parent_id,
                text=sub.get("text", "No text"),
                reasoning=response.get("reasoning", ""),
                is_leaf=False
            ))
            new_work_items.append(WorkItem(id=child_id, action=next_action))
            
        updated_tree = state["hypothesis_tree"] + new_nodes
        print_tree(updated_tree, title=f"BREAKDOWN OF {parent_id}")

        return {
            "hypothesis_tree": updated_tree,
            "nodes_to_process": remaining_nodes + new_work_items, # BFS Queue
            "explainability_log": [f"Broke down {parent_id}"]
        }