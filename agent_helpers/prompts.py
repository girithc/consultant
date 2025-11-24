from langchain_core.prompts import ChatPromptTemplate

# 1. ROOT HYPOTHESIS WITH CONTEXT
top_hypothesis_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant. 
    First, analyze the provided RESEARCH CONTEXT to understand the reality of the problem.
    Then, define exactly 2 distinct, high-level ROOT hypotheses.
    
    Context from Web/Memory:
    {context}
    
    Respond in JSON format:
    {{
        "hypotheses": [
            {{ "text": "Hypothesis 1...", "reasoning": "Based on research..." }},
            {{ "text": "Hypothesis 2...", "reasoning": "Based on research..." }}
        ]
    }}
    <|end|>
    """
)

# 2. CLASSIFIER PROMPT
classifier_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant.
    Your task is to classify a hypothesis node in a hypothesis tree.
    
    Determine if the hypothesis is a "leaf" (specific enough to be analyzed directly) or a "branch" (needs further breakdown).
    
    Hypothesis:
    {hypothesis_text}
    
    Context:
    {context}
    
    Respond in JSON format:
    {{
        "classification": "leaf" | "branch",
        "reasoning": "Explanation..."
    }}
    <|end|>
    """
)

# 3. ANALYSIS PROMPT
analysis_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant.
    Your task is to identify the specific analysis required to validate or refute a hypothesis.
    
    Hypothesis:
    {hypothesis_text}
    
    Context:
    {context}
    
    Respond in JSON format:
    {{
        "analysis_required": "Description of analysis...",
        "reasoning": "Explanation..."
    }}
    <|end|>
    """
)

# 4. SOURCE PROMPT
source_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant.
    Your task is to identify the best source of data for the required analysis.
    
    Analysis Required:
    {analysis_required}
    
    Context:
    {context}
    
    Respond in JSON format:
    {{
        "source": "Description of source...",
        "reasoning": "Explanation..."
    }}
    <|end|>
    """
)

# 5. BREAKDOWN PROMPT
breakdown_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant.
    Your task is to break down a high-level hypothesis into more specific, testable sub-hypotheses (MECE).
    
    Parent Hypothesis:
    {hypothesis_text}
    
    Context:
    {context}
    
    Respond in JSON format:
    {{
        "sub_hypotheses": [
            {{ "text": "Sub-hypothesis 1...", "reasoning": "Why this is a necessary component..." }},
            {{ "text": "Sub-hypothesis 2...", "reasoning": "Why this is a necessary component..." }}
        ]
    }}
    <|end|>
    """
)