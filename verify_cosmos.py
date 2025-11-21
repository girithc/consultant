import os
import sys
from unittest.mock import MagicMock, patch

# Mock environment variables
os.environ["OPENAI_API_KEY"] = "test_key"
os.environ["TAVILY_API_KEY"] = "test_key"
# Ensure we don't actually connect to Cosmos unless we want to (we'll test the mock mode)
if "AZURE_COSMOS_ENDPOINT" in os.environ:
    del os.environ["AZURE_COSMOS_ENDPOINT"]

# Add current directory to path
sys.path.append(os.getcwd())

from agent_helpers.cosmos_db import CosmosDB
from agent_helpers.tools import web_search
from agent_helpers.research import ResearchAgent

def test_cosmos_singleton():
    print("Testing CosmosDB singleton...")
    db1 = CosmosDB()
    db2 = CosmosDB()
    assert db1 is db2
    print("PASS: Singleton works.")

def test_web_search_logging():
    print("Testing web_search logging...")
    with patch('agent_helpers.tools.TavilySearchResults') as mock_tavily:
        mock_tool = MagicMock()
        mock_tool.invoke.return_value = [{"url": "http://test.com", "content": "test content"}]
        mock_tavily.return_value = mock_tool
        
        # Spy on CosmosDB.log_search
        with patch.object(CosmosDB, 'log_search') as mock_log:
            web_search("test query")
            mock_log.assert_called_once()
            print("PASS: Web search logs to CosmosDB.")

def test_classify_no_web_search():
    print("Testing classify_hypothesis (no web search)...")
    
    # Mock dependencies
    mock_llm = MagicMock()
    mock_vector = MagicMock()
    mock_vector.search.return_value = "Memory context"
    
    agent = ResearchAgent(mock_llm, mock_vector, MagicMock(), MagicMock(), MagicMock())
    
    # Mock state
    state = {
        "nodes_to_process": [{"id": "1", "action": "classify"}],
        "hypothesis_tree": [{"id": "1", "text": "Test hypothesis", "parent_id": "0"}]
    }
    
    # Mock LLM chain
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = {"classification": "leaf"}
    agent.get_llm_chain = MagicMock(return_value=mock_chain)
    
    # Spy on CosmosDB.log_interaction
    with patch.object(CosmosDB, 'log_interaction') as mock_log:
        agent.classify_hypothesis(state)
        
        # Verify vector store was called (instead of gather_context which calls web search)
        mock_vector.search.assert_called_with("Test hypothesis")
        
        # Verify logging
        mock_log.assert_called_once()
        args, _ = mock_log.call_args
        assert args[0] == "ResearchAgent.classify"
        
        print("PASS: Classify uses vector store and logs interaction.")

if __name__ == "__main__":
    try:
        test_cosmos_singleton()
        test_web_search_logging()
        test_classify_no_web_search()
        print("\nALL TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()
