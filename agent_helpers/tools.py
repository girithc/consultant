import os
import matplotlib.pyplot as plt
import json
import warnings

# --- LangChain / AI Imports ---
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.docstore.document import Document
from langchain_experimental.utilities import PythonREPL

# --- CRITICAL FIX: Use TavilySearchResults from Community ---
# The 'langchain_tavily' package's TavilySearch class returns a different format.
# We use the community version which reliably returns a List[Dict].
try:
    from langchain_community.tools.tavily_search import TavilySearchResults
except ImportError:
    # Fallback if community is missing (unlikely)
    from langchain_tavily import TavilySearchResults

# ==========================================
# TOOL 1: Vector Store
# ==========================================
class VectorStore:
    def __init__(self):
        if "OPENAI_API_KEY" not in os.environ:
            print("Error: OPENAI_API_KEY not found.")
            return

        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        self.db_path = "agent_memory"
        
        if os.path.exists(self.db_path):
            try:
                self.db = FAISS.load_local(self.db_path, self.embeddings, allow_dangerous_deserialization=True)
            except:
                self._create_new_db()
        else:
            self._create_new_db()

    def _create_new_db(self):
        dummy_doc = Document(page_content="Agent memory initialized.")
        self.db = FAISS.from_documents([dummy_doc], self.embeddings)
        self.db.save_local(self.db_path)

    def search(self, query: str, k: int = 3) -> str:
        try:
            results = self.db.similarity_search(query, k=k)
            if not results: return ""
            return "\n".join([f"[Memory] {res.page_content}" for res in results])
        except: return ""

# ==========================================
# TOOL 2: Web Search (Fixed)
# ==========================================
from agent_helpers.cosmos_db import CosmosDB

def web_search(query: str) -> str:
    """Executes a real web search."""
    if "TAVILY_API_KEY" not in os.environ:
        return "[Simulated Search] No API Key found."

    try:
        print(f"   [WebSearch] Searching: '{query[:40]}...'")
        
        # FIX: Use TavilySearchResults (returns list of dicts)
        tool = TavilySearchResults(max_results=3) 
        results = tool.invoke({"query": query})
        
        # Safety Check: Ensure results is a list
        if isinstance(results, str):
            return f"[Search Output] {results}" # Handle raw string return
            
        context = ""
        # Iterate assuming List[Dict]
        for res in results:
            # Handle case where res might not be a dict
            if isinstance(res, dict):
                url = res.get('url', 'No URL')
                content = res.get('content', 'No Content')
                context += f"\n[Source: {url}]\n{content[:300]}...\n"
            else:
                context += f"\n[Result] {str(res)}\n"
        
        # Log to Cosmos DB
        try:
            CosmosDB().log_search(query, results if isinstance(results, list) else [{"raw": str(results)}])
        except Exception as log_err:
            print(f"   [WebSearch] Logging failed: {log_err}")

        return context

    except Exception as e:
        print(f"   [WebSearch] Error: {e}")
        return "[Error in Web Search]"

# ==========================================
# TOOL 3: Python REPL
# ==========================================
def run_python_analysis(code: str) -> str:
    print(f"[PythonREPL] Executing analysis...")
    try:
        repl = PythonREPL()
        clean_code = code.replace("```python", "").replace("```", "").strip()
        result = repl.run(clean_code)
        return f"Analysis Result:\n{result}"
    except Exception as e:
        return f"Error executing Python code: {e}"

# ==========================================
# TOOL 4: Chart Generator
# ==========================================
def generate_chart(data: dict, title: str, filename: str = "chart_output.png") -> str:
    print(f"[ChartGen] Generating chart: '{title}'...")
    try:
        plt.switch_backend('Agg') 
        plt.figure(figsize=(10, 6))
        plt.bar(list(data.keys()), list(data.values()), color='skyblue')
        plt.title(title)
        plt.savefig(filename)
        plt.close()
        return f"Chart saved to {filename}"
    except Exception as e:
        return f"Error generating chart: {e}"