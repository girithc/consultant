from langchain_core.output_parsers import StrOutputParser
from .prompts import top_hypothesis_prompt, breakdown_prompt
from .types import AgentState, Hypothesis, WorkItem 
from agent_helpers.types import print_tree 
from agent_helpers.cosmos_db import CosmosDB 
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
    def __init__(self, llm, web_search_tool):
        self.llm = llm
        self.web_search = web_search_tool

    def get_llm_chain(self, prompt_template):
        return prompt_template | self.llm | StrOutputParser() | parse_json_from_string

    def formulate_top_hypothesis(self, state: AgentState) -> dict:
        print("\n--- Executing Node: formulate_top_hypothesis ---")
        problem = state["problem_statement"]
        
        # Log the start of the strategy phase
        initial_log = f"I'm starting by analyzing your problem: '{problem}' to figure out the best approach."
        
        # 1. RESEARCH FIRST
        print(f"   [Strategist] Researching problem context: '{problem[:30]}...'")
        context = self.web_search(problem)
        
        search_log = f"I'm looking up some initial information about '{problem}' to get up to speed."
        
        # RAG Integration
        scratchpad_id = state.get("scratchpad_id")
        doc_context_found = False
        if scratchpad_id:
            print(f"   [Strategist] Searching documents for scratchpad: {scratchpad_id}")
            doc_context = CosmosDB().search_documents(scratchpad_id, problem)
            if doc_context:
                print(f"   [Strategist] Found relevant document context.")
                context += f"\n\n[INTERNAL DOCUMENTS]:\n{doc_context}"
                doc_context_found = True
        
        # 2. THEN FORMULATE
        chain = self.get_llm_chain(top_hypothesis_prompt)
        response = chain.invoke({"problem": problem, "context": context})
        
        hypotheses_list = response.get("hypotheses", [])
        if isinstance(hypotheses_list, dict): hypotheses_list = [hypotheses_list]

        new_nodes = []
        new_work_items = []
        
        for i, h_data in enumerate(hypotheses_list[:2]): 
            # Apply offset to root IDs OR use parent_node_id
            parent_node_id = state.get("parent_node_id")
            
            if parent_node_id:
                # If we have a parent (the Problem Node), these are its children
                node_id = f"{parent_node_id}.{i + 1}"
                parent_id = parent_node_id
            else:
                # Legacy / Fallback: Create new roots
                offset = state.get("root_id_offset", 0)
                node_id = str(i + 1 + offset)
                parent_id = "0"
            
            tools_used = ["Web Search"]
            if doc_context_found:
                tools_used.append("RAG")
            
            new_nodes.append(Hypothesis(
                id=node_id, 
                parent_id=parent_id, 
                text=h_data.get("text", "No text"), 
                reasoning=h_data.get("reasoning", ""), 
                is_leaf=False,
                children_ids=[],
                tools_used=tools_used
            ))
            new_work_items.append(WorkItem(id=node_id, action="breakdown"))

        print_tree(new_nodes, title="INITIAL HYPOTHESES (DATA-DRIVEN)")
        
        try:
            CosmosDB().log_interaction("StrategistAgent.formulate_top_hypothesis", 
                                     {"problem": problem, "context": context}, 
                                     response)
        except Exception as e:
            print(f"   [Strategist] Logging failed: {e}")

        return {
            "hypothesis_tree": new_nodes,
            "nodes_to_process": new_work_items,
            "explainability_log": [initial_log, search_log, "I've come up with a few initial hypotheses based on what I found."]
        }

    def breakdown_hypothesis(self, state: AgentState) -> dict:
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes = state["nodes_to_process"][1:]
        parent_id = item_to_process["id"]
        
        parent_node = next(h for h in state["hypothesis_tree"] if h["id"] == parent_id)
        print(f"\n--- Executing Node: breakdown_hypothesis for {parent_id} ---")
        
        # Log action
        action_log = f"I'm going to break down this point: '{parent_node['text']}' to understand it better."

        # 1. RESEARCH FIRST
        print(f"   [Strategist] Researching context for: '{parent_node['text']}'")
        context = self.web_search(parent_node["text"])
        
        research_log = f"I'm searching for specific details about '{parent_node['text']}'."

        scratchpad_id = state.get("scratchpad_id")
        doc_context_found = False
        if scratchpad_id:
            print(f"   [Strategist] Searching documents for scratchpad: {scratchpad_id}")
            doc_context = CosmosDB().search_documents(scratchpad_id, parent_node["text"])
            if doc_context:
                print(f"   [Strategist] Found relevant document context.")
                context += f"\n\n[INTERNAL DOCUMENTS]:\n{doc_context}"
                doc_context_found = True
        
        # 2. THEN BREAKDOWN
        chain = self.get_llm_chain(breakdown_prompt)
        response = chain.invoke({"hypothesis_text": parent_node["text"], "context": context})
        
        # FIX: Handle Error - Mark as leaf, do NOT queue 'analyze'
        if "error" in response:
            print(f"   [Strategist] Breakdown failed for {parent_id}. Marking as leaf.")
            parent_node["is_leaf"] = True
            
            updated_tree = [h if h["id"] != parent_id else parent_node for h in state["hypothesis_tree"]]
            # Just return remaining nodes, do not add 'analyze'
            return {
                "hypothesis_tree": updated_tree,
                "nodes_to_process": remaining_nodes,
                "explainability_log": [f"I couldn't break this down further, so I'll mark it as complete."]
            }

        sub_hypotheses = response.get("sub_hypotheses", [])[:2]
        
        # FIX: No subs - Mark as leaf, do NOT queue 'analyze'
        if not sub_hypotheses:
            print(f"   [Strategist] No sub-hypotheses found for {parent_id}. Marking as leaf.")
            parent_node["is_leaf"] = True
            
            updated_tree = [h if h["id"] != parent_id else parent_node for h in state["hypothesis_tree"]]
            # Just return remaining nodes, do not add 'analyze'
            return {
                "hypothesis_tree": updated_tree,
                "nodes_to_process": remaining_nodes,
                "explainability_log": [f"I think this point is solid enough as is. Marking it complete."]
            }
        
        new_nodes = []
        new_work_items = []
        
        existing_kids = [h for h in state["hypothesis_tree"] if h["parent_id"] == parent_id]
        if len(existing_kids) >= 2:
            print(f"   [Strategist] Node {parent_id} already has {len(existing_kids)} children. Skipping breakdown.")
            return {"nodes_to_process": remaining_nodes}
            
        start_index = len(existing_kids) + 1

        for i, sub in enumerate(sub_hypotheses):
            child_id = f"{parent_id}.{start_index + i}"
            depth = len(child_id.split('.'))
            
            # MAX DEPTH LOGIC
            if depth >= 4:
                print(f"   [Strategist] Node {child_id} reached max depth (4). Marking as LEAF.")
                is_leaf = True
                next_action = None # No further action
            else:
                is_leaf = False
                next_action = "classify" if depth >= 2 else "breakdown"
            
            tools_used = ["Web Search"]
            if doc_context_found:
                tools_used.append("RAG")

            new_nodes.append(Hypothesis(
                id=child_id,
                parent_id=parent_id,
                text=sub.get("text", "No text"),
                reasoning=sub.get("reasoning", ""),
                is_leaf=is_leaf,
                children_ids=[],
                tools_used=tools_used
            ))
            
            if next_action:
                new_work_items.append(WorkItem(id=child_id, action=next_action))
            
        parent_node["children_ids"] = [n["id"] for n in new_nodes]
        updated_tree = [h if h["id"] != parent_id else parent_node for h in state["hypothesis_tree"]] + new_nodes
        print_tree(updated_tree, title=f"BREAKDOWN OF {parent_id}")

        try:
            CosmosDB().log_interaction("StrategistAgent.breakdown_hypothesis", 
                                     {"parent_hypothesis": parent_node["text"], "context": context}, 
                                     response)
        except Exception as e:
            print(f"   [Strategist] Logging failed: {e}")

        return {
            "hypothesis_tree": updated_tree,
            "nodes_to_process": remaining_nodes + new_work_items,
            "explainability_log": [action_log, research_log, f"I've identified some sub-points for {parent_id}."]
        }