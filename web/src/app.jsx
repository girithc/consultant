import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import axios from 'axios';
import API_BASE_URL from './config';

// --- 1. Custom Node Component (Visual Design) ---
const HypothesisNode = ({ data }) => {
  return (
    <div style={{
      padding: '10px',
      border: '1px solid #777',
      borderRadius: '5px',
      background: '#fff',
      minWidth: '250px',
      maxWidth: '300px',
      fontSize: '12px'
    }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>
        {data.id}
      </div>
      <div style={{ marginBottom: '8px' }}>
        {data.label}
      </div>
      {data.reasoning && (
        <div style={{
          fontStyle: 'italic',
          color: '#555',
          background: '#f9f9f9',
          padding: '5px',
          borderRadius: '3px'
        }}>
          "{data.reasoning.substring(0, 80)}..."
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = { hypothesis: HypothesisNode };

// --- 2. Auto-Layout Helper (Dagre) ---
const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'TB' }); // Top-to-Bottom layout

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 150 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 150, // Center offset
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- 3. Main App Component ---
export default function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState("Why are sales declining?");

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // --- Fetch & Transform Data ---
  const generateTree = async () => {
    setLoading(true);
    try {
      // 1. Call your Python Backend
      const response = await axios.post(`${API_BASE_URL}/generate-tree`, null, {
        params: { problem }
      });

      const rawTree = response.data.hypothesis_tree;

      // 2. Convert Python Dicts to React Flow Nodes
      const newNodes = rawTree.map((h) => ({
        id: h.id,
        type: 'hypothesis',
        data: { id: h.id, label: h.text, reasoning: h.reasoning },
        position: { x: 0, y: 0 } // Position set by Dagre later
      }));

      // 3. Create Edges (Parent -> Child)
      const newEdges = rawTree
        .filter((h) => h.parent_id !== "0") // Skip root parent logic for edges
        .map((h) => ({
          id: `e${h.parent_id}-${h.id}`,
          source: h.parent_id,
          target: h.id,
          type: 'smoothstep'
        }));

      // 4. Apply Auto-Layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        newNodes,
        newEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (error) {
      console.error("Error fetching tree:", error);
      alert("Failed to connect to backend. Is server.py running?");
    }
    setLoading(false);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Controls Header */}
      <div style={{ padding: '20px', background: '#f0f0f0', borderBottom: '1px solid #ccc', display: 'flex', gap: '10px' }}>
        <input
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button
          onClick={generateTree}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Consultant is Thinking...' : 'Generate Strategy'}
        </button>
      </div>

      {/* React Flow Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}