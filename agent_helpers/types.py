from typing import TypedDict, List, Dict, Any, Optional

class Hypothesis(TypedDict):
    """Represents a single node in the hypothesis tree."""
    id: str
    parent_id: str
    text: str
    reasoning: str
    is_leaf: bool

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
    
    # The tree is a flat list of Hypothesis nodes
    hypothesis_tree: List[Hypothesis]
    
    # This is the "to-do" list
    nodes_to_process: List[WorkItem]
    
    # This tracks the last *completed* item, so the user can review it
    last_completed_item_id: Optional[str]
    
    # Final output
    analyses_needed: List[Analysis]
    
    # XAI Log
    explainability_log: List[str]