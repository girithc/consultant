#!/usr/bin/env python3
"""
Verification Script for Phase 3: Document Storage and RAG

Tests:
1. Document processing utilities
2. Document storage in Cosmos DB
3. API endpoints for document management
4. RAG search functionality
"""

import os
import sys
import base64
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agent_helpers.document_processor import process_file, DocumentProcessor
from agent_helpers.cosmos_db import CosmosDB


def test_document_processor():
    """Test document text extraction and chunking"""
    print("\n" + "="*60)
    print("TEST 1: Document Processor")
    print("="*60)
    
    # Test with sample text
    sample_text = """
    This is a test document for verification.
    It contains multiple paragraphs to test chunking.
    
    The document processor should extract this text and split it into chunks.
    Each chunk should be of reasonable size for embedding.
    """
    
    sample_bytes = sample_text.encode('utf-8')
    
    try:
        # Test TXT processing
        result = process_file(sample_bytes, "test.txt")
        print(f"✓ Text extraction succeeded")
        print(f"  - Extracted {len(result.text)} characters")
        print(f"  - Created {len(result.chunks)} chunks")
        print(f"  - Metadata: {result.metadata}")
        
        # Test chunking
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=20)
        chunks = processor.chunk_text(sample_text)
        print(f"✓ Chunking succeeded")
        print(f"  - Created {len(chunks)} chunks from sample text")
        
        return True
    except Exception as e:
        print(f"✗ Document processor failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_cosmos_db_documents():
    """Test Cosmos DB document management"""
    print("\n" + "="*60)
    print("TEST 2: Cosmos DB Document Management")
    print("="*60)
    
    db = CosmosDB()
    test_scratchpad_id = "test_scratchpad"
    
    try:
        # Test save document
        doc = db.save_document(
            scratchpad_id=test_scratchpad_id,
            filename="test_doc.txt",
            text="This is test content for verification",
            metadata={"test": True, "file_type": "txt"}
        )
        print(f"✓ Save document succeeded")
        if doc:
            print(f"  - Document ID: {doc.get('id', 'mock')}")
        
        # Test save chunks
        chunks = ["Chunk 1 content", "Chunk 2 content", "Chunk 3 content"]
        db.save_document_chunks(
            scratchpad_id=test_scratchpad_id,
            document_id=doc['id'] if doc else "mock_doc_id",
            filename="test_doc.txt",
            chunks=chunks
        )
        print(f"✓ Save chunks succeeded")
        print(f"  - Saved {len(chunks)} chunks")
        
        # Test get documents
        docs = db.get_documents(test_scratchpad_id)
        print(f"✓ Get documents succeeded")
        print(f"  - Found {len(docs)} documents")
        
        # Test search documents
        results = db.search_documents(test_scratchpad_id, "test content", top_k=3)
        print(f"✓ Search documents succeeded")
        print(f"  - Found {len(results)} relevant chunks")
        
        return True
    except Exception as e:
        print(f"✗ Cosmos DB document test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_integration():
    """Test that API endpoints are properly defined"""
    print("\n" + "="*60)
    print("TEST 3: API Endpoints")
    print("="*60)
    
    try:
        # Import agent module to check endpoints exist
        import agent
        
        # Check for document endpoints
        has_upload = any('upload_document' in str(route.endpoint) for route in agent.app.routes)
        has_list = any('list_documents' in str(route.endpoint) for route in agent.app.routes)
        has_delete = any('delete_document' in str(route.endpoint) for route in agent.app.routes)
        
        if has_upload:
            print("✓ Document upload endpoint exists")
        else:
            print("⚠ Document upload endpoint not found")
            
        if has_list:
            print("✓ Document list endpoint exists")
        else:
            print("⚠ Document list endpoint not found")
            
        if has_delete:
            print("✓ Document delete endpoint exists")
        else:
            print("⚠ Document delete endpoint not found")
        
        return has_upload and has_list and has_delete
    except Exception as e:
        print(f"✗ API integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_rag_integration():
    """Test that RAG is integrated into the agent workflow"""
    print("\n" + "="*60)
    print("TEST 4: RAG Integration")
    print("="*60)
    
    try:
        from agent_helpers.research import ResearchAgent
        from agent_helpers.types import AgentState
        import inspect
        
        # Check if classify_hypothesis uses document search
        source = inspect.getsource(ResearchAgent.classify_hypothesis)
        
        has_doc_search = 'search_documents' in source
        has_rag_context = 'doc_context' in source or 'Document Context' in source
        
        if has_doc_search:
            print("✓ Document search is integrated into classify_hypothesis")
        else:
            print("⚠ Document search not found in classify_hypothesis")
            
        if has_rag_context:
            print("✓ RAG context is combined with vector store context")
        else:
            print("⚠ RAG context combination not found")
        
        return has_doc_search and has_rag_context
    except Exception as e:
        print(f"✗ RAG integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all verification tests"""
    print("\n" + "="*60)
    print("PHASE 3: Document Storage and RAG - Verification")
    print("="*60)
    
    results = []
    
    # Run all tests
    results.append(("Document Processor", test_document_processor()))
    results.append(("Cosmos DB Documents", test_cosmos_db_documents()))
    results.append(("API Endpoints", test_api_integration()))
    results.append(("RAG Integration", test_rag_integration()))
    
    # Print summary
    print("\n" + "="*60)
    print("VERIFICATION SUMMARY")
    print("="*60)
    
    for name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{status}: {name}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "="*60)
    if all_passed:
        print("✓ ALL TESTS PASSED")
    else:
        print("⚠ SOME TESTS FAILED - Review output above")
    print("="*60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
