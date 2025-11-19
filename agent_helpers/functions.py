from typing import List



# --- Tree Printing Function (NEW) ---
from agent_helpers.types import Hypothesis


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
        
        # Determine depth from ID format (1, 1.1, 1.1.1)
        depth = len(node_id.split('.'))
        
        # Print only up to depth 3
        if depth <= 3:
            print(f"{indent}* ({node['id']}){leaf_marker}: {node['text']}")
            print(f"{indent}  [Reasoning]: {node['reasoning'][:100]}...") # Truncate reasoning for clean print
            
            children = [h for h in tree if h.get("parent_id") == node_id]
            for child in children:
                print_node(child["id"], indent + "  ")
    
    # Start from the root (ID "1")
    if tree:
        print_node("1")
    else:
        print("Tree is empty.")
    print("="*50)
# --- End of Tree Printing Function ---
