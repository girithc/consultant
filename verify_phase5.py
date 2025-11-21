import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def run_agent_test():
    print("\n--- Starting Phase 5 Verification ---")
    
    # 1. Start Agent
    payload = {
        "problem_statement": "How can a legacy bank compete with fintech startups?",
        "scratchpad_id": "test_phase5"
    }
    
    print(f"Sending request to {BASE_URL}/run_agent...")
    try:
        response = requests.post(f"{BASE_URL}/run_agent", json=payload, stream=True)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to connect to agent: {e}")
        return

    print("Stream connected. Listening for updates...")
    
    final_tree = []
    logs = []
    
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line.decode('utf-8'))
                if "hypothesis_tree" in data:
                    final_tree = data["hypothesis_tree"]
                if "explainability_log" in data:
                    logs = data["explainability_log"]
                    print(f"Log: {logs[-1]}")
            except json.JSONDecodeError:
                pass

    print("\n--- Analysis Complete ---")
    
    # 2. Verify Tools Used
    print("\n[Check 1] Verifying 'tools_used' field...")
    tools_found = False
    for node in final_tree:
        if "tools_used" in node:
            print(f"Node {node['id']} tools: {node['tools_used']}")
            tools_found = True
        else:
            print(f"Node {node['id']} MISSING tools_used!")
            
    if tools_found:
        print("PASS: 'tools_used' field is present.")
    else:
        print("FAIL: 'tools_used' field missing.")

    # 3. Verify Distinct Reasoning
    print("\n[Check 2] Verifying distinct reasoning in siblings...")
    siblings = {}
    for node in final_tree:
        parent = node.get("parent_id", "0")
        if parent not in siblings:
            siblings[parent] = []
        siblings[parent].append(node)
        
    duplicate_reasoning = False
    for parent, kids in siblings.items():
        if len(kids) > 1:
            reasons = [k.get("reasoning", "") for k in kids]
            if len(set(reasons)) < len(reasons):
                print(f"FAIL: Duplicate reasoning found for children of {parent}:")
                for k in kids:
                    print(f"  - {k['id']}: {k.get('reasoning')[:50]}...")
                duplicate_reasoning = True
            else:
                print(f"PASS: Children of {parent} have distinct reasoning.")
                
    if not duplicate_reasoning:
        print("PASS: All sibling groups have distinct reasoning.")

    # 4. Verify Termination Logic
    print("\n[Check 3] Verifying termination logic...")
    orphaned_nodes = [n for n in final_tree if not n["is_leaf"] and not n.get("children_ids")]
    
    if orphaned_nodes:
        print(f"FAIL: Found {len(orphaned_nodes)} orphaned nodes (not leaf, no children):")
        for n in orphaned_nodes:
            print(f"  - {n['id']}: {n['text'][:50]}...")
    else:
        print("PASS: No orphaned nodes found. Tree is complete.")

if __name__ == "__main__":
    run_agent_test()
