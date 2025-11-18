import os
import re
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.docstore.document import Document

# --- Vector Store (Agent's Memory) ---
# This uses a local, file-based model to create embeddings
# and stores them in a local "agent_memory" folder.

class VectorStore:
    def __init__(self, embedding_model_name='sentence-transformers/all-MiniLM-L6-v2'):
        # Use a local, fast, and lightweight embedding model
        self.embeddings = HuggingFaceEmbeddings(model_name=embedding_model_name)
        self.db_path = "agent_memory"
        
        # Load or create the vector store
        if os.path.exists(self.db_path):
            print("Loading existing agent memory...")
            self.db = FAISS.load_local(self.db_path, self.embeddings, allow_dangerous_deserialization=True)
        else:
            print("Creating new agent memory...")
            # Create an empty index to start
            dummy_doc = Document(page_content="Agent memory initialized.")
            self.db = FAISS.from_documents([dummy_doc], self.embeddings)
            self.db.save_local(self.db_path)
        print("Agent memory (Vector Store) is ready.")

    def add_learning(self, correction_text: str):
        """
        Adds a new 'learning' (a user correction) to the vector store.
        This is the "lasting change".
        """
        print(f"\n[VectorStore] Adding new learning: '{correction_text[:50]}...'")
        doc = Document(page_content=correction_text, metadata={"source": "user_correction"})
        self.db.add_documents([doc])
        self.db.save_local(self.db_path) # Save the changes
        print("[VectorStore] Learning saved.")

    def search(self, query: str, k: int = 3) -> str:
        """
        Searches the vector store for relevant documents.
        This is the "RAG" part.
        """
        print(f"[VectorStore] Searching for: '{query}'")
        try:
            results = self.db.similarity_search(query, k=k)
            if not results:
                return "No relevant information found in agent memory."
            
            return "\n---\n".join([f"Source: {res.metadata.get('source', 'unknown')}\nContent: {res.page_content}" for res in results])
        except Exception as e:
            print(f"[VectorStore] Error during search: {e}")
            return "Error searching agent memory."

# --- Web Search Tool ---

def simulated_web_search(query: str) -> str:
    """
    A simulated web search tool.
    TODO: Replace this with a real tool like TavilySearch.
    """
    print(f"[WebSearch] Simulating search for: '{query}'")
    
    # Simple rule-based simulation
    if "competitor" in query.lower():
        return "Simulated Web Search: Found a market report indicating competitors (e.g., 'Shopify', 'BigCommerce') increased ad spend by 10% in the last quarter."
    if "market" in query.lower():
        return "Simulated Web Search: Found articles suggesting the e-commerce market is saturating, with customer acquisition costs (CAC) rising across the board."
    
    return "Simulated Web Search: No specific public data found."