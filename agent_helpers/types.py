from typing import TypedDict, List, Dict, Any, Optional

class Hypothesis(TypedDict):
    id: str
    text: str
    reasoning: str
    status: str  # "pending", "accepted", "rejected"
    parent_id: Optional[str]
    children_ids: List[str]
    is_leaf: bool
    depth: int
    tools_used: List[str]  # e.g., ["Web Search", "RAG", "Python"]

class Analysis(TypedDict):
    """Represents the analysis required for a leaf hypothesis."""
    hypothesis_id: str
    analysis_required: str
    analysis_reasoning: str
    source_of_reference: str
    source_reasoning: str

class WorkItem(TypedDict):
    """A single item in the agent's to-do list."""
    id: str
    action: str # "breakdown", "classify", "analyze"

class AgentState(TypedDict):
    """The central state of the graph."""
    problem_statement: str
    hypothesis_tree: List[Hypothesis]
    nodes_to_process: List[WorkItem]
    last_completed_item_id: Optional[str]
    analyses_needed: List[Analysis]
    explainability_log: List[str]
    existing_tree: Optional[List[Hypothesis]]
    restart_node_id: Optional[str]
    scratchpad_id: Optional[str]
    
def print_tree(tree: List[Hypothesis], title="CURRENT HYPOTHESIS TREE"):
    """Prints the hypothesis tree structure to the console."""
    print("\n" + "="*50)
    print(f"| {title.upper()}")
    print("="*50)
    
    # Helper to print a single node and its children recursively
    def print_node(node_id, indent=""):
        node = next((h for h in tree if h["id"] == node_id), None)
        if not node: return
        
        leaf_marker = " (LEAF)" if node.get("is_leaf", False) else ""
        
        # Print the node
        print(f"{indent}* ({node['id']}){leaf_marker}: {node['text']}")
        # print(f"{indent}  [Reasoning]: {node['reasoning'][:100]}...") # Optional: Uncomment for more detail
        
        # Find children and print them
        children = [h for h in tree if h.get("parent_id") == node_id]
        # Sort children to keep 1.1 before 1.2
        children.sort(key=lambda x: x["id"])
        
        for child in children:
            print_node(child["id"], indent + "  ")
    
    # FIX: Find ALL roots (nodes with parent_id="0"), not just "1"
    roots = [h for h in tree if h["parent_id"] == "0"]
    roots.sort(key=lambda x: x["id"]) # Ensure 1 prints before 2
    
    if roots:
        for root in roots:
            print_node(root["id"])
    else:
        print("Tree is empty.")
    print("="*50)