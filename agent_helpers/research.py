from langchain_core.output_parsers import StrOutputParser
from .prompts import classifier_prompt, analysis_prompt, source_prompt
from agent_helpers.tools import VectorStore, web_search # Imports
from agent_helpers.types import AgentState, Analysis, WorkItem, print_tree
from agent_helpers.cosmos_db import CosmosDB

import json
import re

def parse_json_from_string(text: str) -> dict:
    # (Use the robust parser from previous steps)
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

class ResearchAgent:
    # CHANGE: Update __init__ signature
    def __init__(self, llm, vector_store, web_search_tool, python_tool, chart_tool):
        self.llm = llm
        self.vector_store = vector_store
        self.web_search_tool = web_search_tool
        self.python_tool = python_tool # Store Python Tool
        self.chart_tool = chart_tool   # Store Chart Tool
        print("Research Agent (Analyst) initialized with Python & Charting capabilities.")

    def get_llm_chain(self, prompt_template):
        return prompt_template | self.llm | StrOutputParser() | parse_json_from_string

    def gather_context(self, query: str) -> str:
        if not isinstance(query, str): query = str(query)
        print(f"   [ResearchAgent] Gathering context for: '{query[:40]}...'")
        
        memory_results = self.vector_store.search(query)
        web_results = self.web_search_tool(query)
        
        context = f"""
        --- Context from Agent Memory ---
        {memory_results}
        --- Context from Live Web Search ---
        {web_results}
        """
        return context

    def classify_hypothesis(self, state: AgentState) -> dict:
        # (Same logic as before)
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes = state["nodes_to_process"][1:]
        node_id = item_to_process["id"]
        node = next(h for h in state["hypothesis_tree"] if h["id"] == node_id)
        
        print(f"\n--- Executing Node: classify_hypothesis for {node_id} ---")
        
        # Get context from vector store
        context = self.vector_store.search(node["text"])
        
        # NEW: Get context from scratchpad documents (RAG)
        scratchpad_id = state.get("scratchpad_id")
        doc_context = []
        if scratchpad_id:
            try:
                doc_results = CosmosDB().search_documents(scratchpad_id, node["text"], top_k=3)
                for result in doc_results:
                    doc_context.append(f"From {result.get('filename', 'document')}: {result.get('content', '')}")
            except Exception as e:
                print(f"   [RAG] Document search failed: {e}")
        
        # Combine contexts
        combined_context = context
        if doc_context:
            combined_context += "\n\n--- Document Context ---\n" + "\n".join(doc_context)
        
        chain = self.get_llm_chain(classifier_prompt)
        response = chain.invoke({"hypothesis_text": node["text"], "context": combined_context})
        
        if "error" in response:
            return {"nodes_to_process": remaining_nodes}

        classification = response.get("classification", "branch")
        
        new_work_item = None
        if classification == "leaf":
            new_work_item = WorkItem(id=node_id, action="analyze")
        else:
            new_work_item = WorkItem(id=node_id, action="breakdown")
          # Update node with classification result
        node["is_leaf"] = (classification == "leaf")
        
        # Track tools used
        tools_used = node.get("tools_used", [])
        if "Web Search" not in tools_used:
            tools_used.append("Web Search")
        if doc_context and "RAG" not in tools_used:
            tools_used.append("RAG")
        node["tools_used"] = tools_used
        
        updated_tree = [h if h["id"] != node_id else node for h in state["hypothesis_tree"]]
        
        # If it's a leaf, no further breakdown needed
        new_nodes_to_process = remaining_nodes + ([new_work_item] if new_work_item else [])
            
        print_tree(updated_tree, title="UPDATED CLASSIFICATION")
        
        # Log to Cosmos DB
        try:
            CosmosDB().log_interaction("ResearchAgent.classify", 
                                     {"hypothesis": node["text"], "context": combined_context}, 
                                     response,
                                     scratchpad_id=scratchpad_id)
        except Exception as e:
            print(f"   [ResearchAgent] Logging failed: {e}")

        return {
            "hypothesis_tree": updated_tree,
            "nodes_to_process": new_nodes_to_process,
            "last_completed_item_id": node_id
        }

    def identify_analysis(self, state: AgentState) -> dict:
        # (Same logic as before)
        item_to_process = state["nodes_to_process"][0]
        remaining_nodes = state["nodes_to_process"][1:]
        node_id = item_to_process["id"]
        node = next(h for h in state["hypothesis_tree"] if h["id"] == node_id)
        
        print(f"\n--- Executing Node: identify_analysis for {node_id} ---")
        context = self.gather_context(node["text"])
        
        analysis_chain = self.get_llm_chain(analysis_prompt)
        analysis_response = analysis_chain.invoke({"hypothesis_text": node["text"], "context": context})
        
        if "error" in analysis_response:
            return {"nodes_to_process": remaining_nodes}

        analysis_required = analysis_response.get("analysis_required", "No analysis identified")
        
        # FUTURE TODO: Here you could check 'analysis_required' and if it involves
        # specific math, call self.python_tool(analysis_required)

        source_chain = self.get_llm_chain(source_prompt)
        source_response = source_chain.invoke({"analysis_required": analysis_required, "context": context})
        
        source = source_response.get("source", "No source")
        
        new_analysis = Analysis(
            hypothesis_id=node_id,
            analysis_required=analysis_required,
            analysis_reasoning=analysis_response.get("reasoning", ""),
            source_of_reference=source,
            source_reasoning=source_response.get("reasoning", "")
        )
        
        # Log to Cosmos DB
        try:
            CosmosDB().log_interaction("ResearchAgent.identify_analysis", 
                                     {"hypothesis": node["text"], "context": context}, 
                                     {"analysis": asdict(new_analysis) if is_dataclass(new_analysis) else str(new_analysis)})
        except Exception as e:
            print(f"   [ResearchAgent] Logging failed: {e}")

        return {
            "analyses_needed": state["analyses_needed"] + [new_analysis],
            "nodes_to_process": remaining_nodes,
            "last_completed_item_id": node_id
        }