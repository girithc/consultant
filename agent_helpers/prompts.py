from langchain_core.prompts import ChatPromptTemplate

# Note: The 'context' variable will be filled by the Research Agent
# with RAG results from the vector store and web search.
# For the Strategist, 'context' will be an empty string.

top_hypothesis_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant. Your task is to define a single, high-level, testable hypothesis for a client's problem.
    Respond in JSON format with two keys:
    1. "hypothesis_text": The single hypothesis.
    2. "reasoning": Your expert reasoning for this as the top-level hypothesis.
    
    Important: Respond *only* with the raw JSON object.
    <|end|>
    <|user|>
    Problem: "{problem}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

breakdown_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant. Break down the given hypothesis into 2-4 MECE sub-hypotheses.
    Respond in JSON format with two keys:
    1. "sub_hypotheses": A list of dictionaries, where each has a "text" key.
    2. "reasoning": Your reasoning for this MECE breakdown.
    
    Important: Respond *only* with the raw JSON object.
    <|end|>
    <|user|>
    Main Hypothesis: "{hypothesis_text}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

classifier_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a McKinsey analyst. Classify the hypothesis as "leaf" (directly testable) or "branch" (needs more breakdown).
    
    Use the provided context to inform your decision.
    
    Respond in JSON format with two keys:
    1. "classification": Either "leaf" or "branch".
    2. "reasoning": Your reasoning for this classification.
    
    Important: Respond *only* with the raw JSON object.
    <|end|>
    <|user|>
    Context From Research:
    {context}
    
    Hypothesis: "{hypothesis_text}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

analysis_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a McKinsey analyst. For the given *testable leaf hypothesis*, what specific data or analysis is required to prove or disprove it?
    
    Use the provided context to find a source.
    
    Respond in JSON format with two keys:
    1. "analysis_required": The specific data/analysis needed.
    2. "reasoning": Why this analysis will test the hypothesis.
    
    Important: Respond *only* with the raw JSON object.
    <|end|>
    <|user|>
    Context From Research:
    {context}
    
    Leaf Hypothesis: "{hypothesis_text}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

source_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a McKinsey data expert. For the required analysis, what is the *most likely source* (your "source of reference")?
    
    Use the provided context (especially web search and internal documents) to find the source.
    
    Respond in JSON format with two keys:
    1. "source": The likely source (e.g., "Client's Salesforce CRM", "External market report from 'Nielsen'").
    2. "reasoning": Why you believe this is the correct source.
    
    Important: Respond *only* with the raw JSON object.
    <|end|>
    <|user|>
    Context From Research:
    {context}
    
    Required Analysis: "{analysis_required}"
    JSON:
    <|end|>
    <|assistant|>
    """
)