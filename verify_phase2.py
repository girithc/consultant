import os
import sys
import asyncio
from unittest.mock import MagicMock, patch

# Mock environment variables
os.environ["OPENAI_API_KEY"] = "test_key"
os.environ["TAVILY_API_KEY"] = "test_key"
if "AZURE_COSMOS_ENDPOINT" in os.environ:
    del os.environ["AZURE_COSMOS_ENDPOINT"]

sys.path.append(os.getcwd())

from agent_helpers.cosmos_db import CosmosDB

def test_auth_flow():
    print("Testing Auth Flow (Mock Mode)...")
    db = CosmosDB()
    
    # Test Register
    user = db.create_user("testuser", "password123")
    assert user["username"] == "testuser"
    print("PASS: Register user")
    
    # Test Login
    logged_in = db.get_user("test", "test") # Mock mode specific
    assert logged_in["username"] == "test"
    print("PASS: Login user")

def test_scratchpad_crud():
    print("Testing Scratchpad CRUD (Mock Mode)...")
    db = CosmosDB()
    
    # Create
    pad = db.create_scratchpad("user123", "My Project")
    assert pad["title"] == "My Project"
    assert pad["user_id"] == "user123"
    print("PASS: Create scratchpad")
    
    # Get
    pads = db.get_scratchpads("user123")
    assert len(pads) > 0
    print("PASS: Get scratchpads")

def test_vector_knowledge():
    print("Testing Vector Knowledge (Mock Mode)...")
    db = CosmosDB()
    
    # Mock embeddings
    with patch('langchain_openai.OpenAIEmbeddings') as mock_embed:
        mock_instance = MagicMock()
        mock_instance.embed_query.return_value = [0.1, 0.2, 0.3]
        mock_embed.return_value = mock_instance
        
        # Enable DB temporarily to test logic flow (even if mock)
        # Actually, in mock mode, save_knowledge just prints.
        # We can verify it doesn't crash.
        db.save_knowledge("Test content", {"type": "test"})
        print("PASS: Save knowledge (Mock)")
        
        results = db.search_knowledge("query")
        assert isinstance(results, list)
        print("PASS: Search knowledge (Mock)")

if __name__ == "__main__":
    try:
        test_auth_flow()
        test_scratchpad_crud()
        test_vector_knowledge()
        print("\nALL TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()
