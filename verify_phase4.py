#!/usr/bin/env python3
"""
Verification Script for Phase 4: Logic Refinement & Edit Feature

Tests:
1. Backend restart logic (Edit & Resubmit)
"""

import sys
import json
import asyncio
import requests
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

BASE_URL = "http://localhost:8000"

def test_restart_logic():
    """Test the backend restart logic"""
    print("\n" + "="*60)
    print("TEST 1: Backend Restart Logic")
    print("="*60)
    
    # 1. Create a mock existing tree
    existing_tree = [
        {"id": "1", "parent_id": "0", "text": "Root Hypothesis 1", "reasoning": "Reason 1", "is_leaf": False},
        {"id": "2", "parent_id": "0", "text": "Root Hypothesis 2", "reasoning": "Reason 2", "is_leaf": False},
        {"id": "1.1", "parent_id": "1", "text": "Child 1.1", "reasoning": "Reason 1.1", "is_leaf": False},
        {"id": "1.2", "parent_id": "1", "text": "Child 1.2", "reasoning": "Reason 1.2", "is_leaf": True},
        {"id": "1.1.1", "parent_id": "1.1", "text": "Grandchild 1.1.1", "reasoning": "Reason 1.1.1", "is_leaf": True}
    ]
    
    # We want to restart from "1.1"
    restart_node_id = "1.1"
    
    payload = {
        "problem_statement": "Test Problem",
        "existing_tree": existing_tree,
        "restart_node_id": restart_node_id
    }
    
    print(f"Restarting from node {restart_node_id}...")
    
    try:
        response = requests.post(f"{BASE_URL}/run_agent", json=payload, stream=True)
        
        if response.status_code != 200:
            print(f"✗ Request failed with status {response.status_code}")
            return False
            
        # Read the first few lines of the stream
        lines = []
        for line in response.iter_lines():
            if line:
                lines.append(json.loads(line))
                if len(lines) >= 1:
                    break
        
        if not lines:
            print("✗ No response received")
            return False
            
        first_response = lines[0]
        tree = first_response.get("hypothesis_tree", [])
        logs = first_response.get("explainability_log", [])
        
        print(f"Received tree with {len(tree)} nodes: {[n['id'] for n in tree]}")
        print(f"Logs: {logs}")
        
        # Verification checks
        
        # 1. Check if descendants of 1.1 are removed (1.1.1 should be gone)
        has_grandchild = any(n["id"] == "1.1.1" for n in tree)
        if has_grandchild:
            print("✗ Descendants were NOT pruned (found 1.1.1)")
            return False
        else:
            print("✓ Descendants pruned correctly")
            
        # 2. Check if 1.1 is present and marked as not leaf
        node_1_1 = next((n for n in tree if n["id"] == "1.1"), None)
        if not node_1_1:
            print("✗ Restart node 1.1 missing from tree")
            return False
            
        if node_1_1.get("is_leaf"):
            print("✗ Restart node 1.1 is still marked as leaf (should be False)")
            return False
        else:
            print("✓ Restart node state reset correctly")
            
        # 3. Check logs for restart message
        has_restart_msg = any("Restarting analysis from node 1.1" in log for log in logs)
        if has_restart_msg:
            print("✓ Restart log message found")
        else:
            print("⚠ Restart log message not found (might be in later chunks)")
            
        return True
        
    except Exception as e:
        print(f"✗ Test failed with error: {e}")
        return False

def main():
    """Run verification"""
    print("\n" + "="*60)
    print("PHASE 4: Logic & Edit Feature - Verification")
    print("="*60)
    
    # Ensure server is running
    try:
        requests.get(f"{BASE_URL}/docs")
    except:
        print("✗ Server is not running. Please start 'uvicorn agent:app' first.")
        return 1
        
    passed = test_restart_logic()
    
    print("\n" + "="*60)
    if passed:
        print("✓ ALL TESTS PASSED")
        return 0
    else:
        print("✗ TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
