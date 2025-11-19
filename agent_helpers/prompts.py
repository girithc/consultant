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
    <|user|>
    Problem: "{problem}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

# 2. BREAKDOWN WITH CONTEXT
breakdown_prompt = ChatPromptTemplate.from_template(
    """
    <|system|>
    You are a senior McKinsey consultant. 
    Use the provided RESEARCH CONTEXT to identify real-world drivers for this hypothesis.
    Break it down into EXACTLY 2 sub-hypotheses.
    
    Context from Web/Memory:
    {context}
    
    Respond in JSON format:
    {{
        "sub_hypotheses": [
            {{ "text": "Sub-hypothesis A..." }},
            {{ "text": "Sub-hypothesis B..." }}
        ],
        "reasoning": "Why these drivers?"
    }}
    <|end|>
    <|user|>
    Parent Hypothesis: "{hypothesis_text}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

# (Classifier, Analysis, Source prompts remain same)
classifier_prompt = ChatPromptTemplate.from_template(
    """<|system|>
    Classify as "leaf" (testable) or "branch".
    Context: {context}
    Respond JSON: {{ "classification": "leaf" or "branch", "reasoning": "..." }}
    <|end|>
    <|user|>
    Hypothesis: "{hypothesis_text}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

analysis_prompt = ChatPromptTemplate.from_template(
    """<|system|>
    What data proves this?
    Context: {context}
    Respond JSON: {{ "analysis_required": "...", "reasoning": "..." }}
    <|end|>
    <|user|>
    Leaf Hypothesis: "{hypothesis_text}"
    JSON:
    <|end|>
    <|assistant|>
    """
)

source_prompt = ChatPromptTemplate.from_template(
    """<|system|>
    Best source?
    Context: {context}
    Respond JSON: {{ "source": "...", "reasoning": "..." }}
    <|end|>
    <|user|>
    Analysis: "{analysis_required}"
    JSON:
    <|end|>
    <|assistant|>
    """
)