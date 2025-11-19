import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Sparkles, Loader2, CheckCircle2, BrainCircuit, Search, ChevronRight } from 'lucide-react';

/* ========================================================================
   1. CUSTOM NODE COMPONENT
   Handles animations, "Working" state, and "New" state
   ======================================================================== */
const HypothesisNode = ({ id, data }) => {
  const [isNew, setIsNew] = useState(true);

  // Remove "New" badge after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setIsNew(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const meta = data.meta || {};
  const isWorking = meta.status === 'working';
  const isLeaf = data.is_leaf;

  return (
    <div
      className="hypothesis-node"
      style={{
        position: 'relative',
        padding: '12px 16px',
        border: isLeaf ? '2px solid #10B981' : '1px solid #E2E8F0',
        borderRadius: '12px',
        background: '#fff',
        minWidth: 300,
        maxWidth: 360,
        fontSize: 13,
        boxShadow: isWorking 
          ? '0 0 0 4px rgba(59, 130, 246, 0.2)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.3s ease',
        animation: 'slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        opacity: 0, // Start invisible for animation
        transform: 'translateY(10px)',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94A3B8', width: 8, height: 8 }} />

      {/* --- STATUS BADGES (Top Right) --- */}
      <div style={{ position: 'absolute', top: -10, right: 10, display: 'flex', gap: 6 }}>
        
        {/* 1. "New" Badge */}
        {isNew && (
          <div style={{
            background: '#8B5CF6', color: 'white', fontSize: 10, fontWeight: '700',
            padding: '2px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)', letterSpacing: '0.5px'
          }}>
            <Sparkles size={10} /> NEW
          </div>
        )}

        {/* 2. "Working" Spinner */}
        {isWorking && (
          <div style={{
            background: '#3B82F6', color: 'white', fontSize: 10, fontWeight: '700',
            padding: '2px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)', letterSpacing: '0.5px'
          }}>
            <Loader2 size={10} className="spin" /> {meta.phaseLabel || 'THINKING'}
          </div>
        )}
      </div>

      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ 
          fontWeight: 700, 
          color: '#475569', 
          background: '#F1F5F9', 
          padding: '2px 8px', 
          borderRadius: 6,
          fontSize: 11,
          border: '1px solid #E2E8F0'
        }}>
          {data.id}
        </span>
        {isLeaf && (
          <span style={{ color: '#059669', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> VALIDATED LEAF
          </span>
        )}
      </div>

      {/* --- CONTENT --- */}
      <div style={{ marginBottom: 12, color: '#1E293B', lineHeight: '1.5', fontWeight: 500 }}>
        {data.label}
      </div>

      {/* --- REASONING BOX --- */}
      {data.reasoning && (
        <div style={{ 
          fontSize: 11, 
          color: '#475569', 
          background: '#F8FAFC', 
          padding: '8px 10px', 
          borderRadius: 6, 
          border: '1px solid #E2E8F0',
          fontStyle: 'italic',
          borderLeft: '3px solid #94A3B8',
          lineHeight: '1.4'
        }}>
          "{data.reasoning.length > 140 ? data.reasoning.substring(0, 140) + '...' : data.reasoning}"
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#94A3B8', width: 8, height: 8 }} />
    </div>
  );
};

const nodeTypes = { hypothesis: HypothesisNode };

/* ========================================================================
   2. LOG PARSING & LAYOUT LOGIC
   ======================================================================== */

// Matches logs from your Python Agent (research.py / strat.py)
const parseStepLog = (str = '') => {
  if (str.includes('formulate_top_hypothesis')) return { node: 'formulate', itemId: null }; 
  
  // Match IDs like "1.1", "1.2.1" 
  const idMatch = str.match(/\(([\d.]+)\)/) || str.match(/\s([\d.]+)\s/) || str.match(/node\s([\d.]+)/);
  const itemId = idMatch ? idMatch[1] : null;

  if (str.includes('Classified')) return { node: 'classify', itemId };
  if (str.includes('Identified analysis')) return { node: 'identify', itemId };
  if (str.includes('Broke down')) return { node: 'breakdown', itemId };
  if (str.includes('Researching')) return { node: 'research', itemId };

  return { node: null, itemId: null };
};

const NODE_META_CONFIG = {
  formulate: { phase: 'research', label: 'STRATEGY' },
  breakdown: { phase: 'research', label: 'BREAKDOWN' },
  research:  { phase: 'research', label: 'SEARCHING' },
  classify:  { phase: 'classify', label: 'CLASSIFYING' },
  identify:  { phase: 'identify', label: 'PLANNING' },
};

// Dagre Auto-Layout
const getLayoutedElements = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });

  nodes.forEach((n) => g.setNode(n.id, { width: 320, height: 180 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return { 
      ...n, 
      position: { 
        x: (pos?.x ?? 0) - 160, 
        y: (pos?.y ?? 0) - 90 
      } 
    };
  });

  return { nodes: layoutedNodes, edges };
};

/* ========================================================================
   3. MAIN APPLICATION
   ======================================================================== */
export default function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState("A leading e-commerce client has seen a 15% decline in profits.");
  const [logs, setLogs] = useState([]);

  // Refs for state management without re-renders during streaming
  const nodesMap = useRef(new Map());
  const edgesMap = useRef(new Map());
  const metaMap = useRef(new Map()); // Stores status/timings per node ID
  const queue = useRef([]); // Queue for staggering node appearance

  // -- 1. Layout & Render Loop --
  const updateGraph = useCallback(() => {
    const currentNodes = Array.from(nodesMap.current.values()).map(n => ({
      ...n, 
      data: { ...n.data, meta: metaMap.current.get(n.id) || {} }
    }));
    const currentEdges = Array.from(edgesMap.current.values());
    
    if (currentNodes.length === 0) return;

    const layout = getLayoutedElements(currentNodes, currentEdges);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, []);

  // -- 2. Status Manager --
  const updateNodeStatus = (id, type) => {
    if (!id) return;
    const config = NODE_META_CONFIG[type];
    if (!config) return;

    // Reset all others to idle
    metaMap.current.forEach(m => m.status = 'idle');

    // Set active node
    if (!metaMap.current.has(id)) metaMap.current.set(id, {});
    const meta = metaMap.current.get(id);
    meta.status = 'working';
    meta.phaseLabel = config.label;
    
    // Force update
    updateGraph();
  };

  // -- 3. Stream Handler --
  const generateTree = async () => {
    setLoading(true);
    setNodes([]); setEdges([]); setLogs([]);
    nodesMap.current.clear();
    edgesMap.current.clear();
    metaMap.current.clear();
    queue.current = [];

    try {
      const response = await fetch('http://localhost:8000/run_agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_statement: problem }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Background Interval to drain queue (Staggered Effect)
      const interval = setInterval(() => {
        if (queue.current.length > 0) {
          const nextNodeData = queue.current.shift();
          
          // Add Node
          const newNode = {
            id: nextNodeData.id,
            type: 'hypothesis',
            data: { 
              id: nextNodeData.id, 
              label: nextNodeData.text, 
              reasoning: nextNodeData.reasoning,
              is_leaf: nextNodeData.is_leaf 
            },
            position: { x: 0, y: 0 }
          };
          nodesMap.current.set(nextNodeData.id, newNode);

          // Add Edge
          if (nextNodeData.parent_id && nextNodeData.parent_id !== "0") {
            const edgeId = `e${nextNodeData.parent_id}-${nextNodeData.id}`;
            edgesMap.current.set(edgeId, {
              id: edgeId,
              source: nextNodeData.parent_id,
              target: nextNodeData.id,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#94A3B8', strokeWidth: 2 }
            });
          }
          updateGraph();
        }
      }, 250); // Delay node appearance by 250ms

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            // Handle Logs & Status
            if (data.explainability_log) {
              const logMsg = data.explainability_log[data.explainability_log.length - 1];
              setLogs(prev => [...prev.slice(-4), logMsg]); 
              
              const { node, itemId } = parseStepLog(logMsg);
              if (node && itemId) updateNodeStatus(itemId, node);
            }

            // Handle Tree Data
            if (data.hypothesis_tree) {
              data.hypothesis_tree.forEach(h => {
                if (!nodesMap.current.has(h.id)) {
                  // Check if already in queue to avoid dupes
                  if (!queue.current.find(q => q.id === h.id)) {
                    queue.current.push(h);
                  }
                } else {
                  // Update existing node (e.g. became leaf)
                  const existing = nodesMap.current.get(h.id);
                  existing.data.is_leaf = h.is_leaf;
                  nodesMap.current.set(h.id, existing);
                  // Trigger update immediately for state changes
                  updateGraph(); 
                }
              });
            }
          } catch (e) { console.error(e); }
        }
      }
      clearInterval(interval);
    } catch (err) {
      console.error(err);
      alert("Connection Failed. Is backend running?");
    } finally {
      setLoading(false);
      // Drain remaining queue instantly if stream ends abruptly
      while(queue.current.length > 0) {
        const h = queue.current.shift();
        nodesMap.current.set(h.id, { id: h.id, type: 'hypothesis', data: {id: h.id, label: h.text, reasoning: h.reasoning, is_leaf: h.is_leaf}, position: {x:0,y:0}});
        if(h.parent_id !== "0") edgesMap.current.set(`e${h.parent_id}-${h.id}`, { id: `e${h.parent_id}-${h.id}`, source: h.parent_id, target: h.id, type: 'smoothstep', animated: true, style: { stroke: '#94A3B8', strokeWidth: 2 } });
      }
      updateGraph();
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      {/* --- HEADER --- */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 16, alignItems: 'center', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <div style={{ background: '#2563EB', padding: 6, borderRadius: 8, color: 'white' }}>
            <BrainCircuit size={20} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#0F172A', letterSpacing: '-0.5px' }}>
            McKinsey<span style={{color:'#2563EB'}}>Agent</span>
          </span>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
          <input 
            value={problem} 
            onChange={(e) => setProblem(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px 14px 10px 36px', 
              borderRadius: 8, 
              border: '1px solid #CBD5E1', 
              fontSize: 14, 
              outline: 'none', 
              transition: 'all 0.2s',
              background: '#F8FAFC'
            }}
            placeholder="Enter a complex business problem to solve..."
          />
        </div>
        
        <button 
          onClick={generateTree} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            background: loading ? '#F1F5F9' : '#2563EB', 
            color: loading ? '#94A3B8' : 'white', 
            border: 'none', 
            borderRadius: 8, 
            fontWeight: 600, 
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s',
            boxShadow: loading ? 'none' : '0 2px 4px rgba(37, 99, 235, 0.2)'
          }}
        >
          {loading ? <Loader2 size={16} className="spin"/> : <Sparkles size={16}/>}
          {loading ? 'Processing...' : 'Generate Strategy'}
        </button>
      </div>

      {/* --- CANVAS --- */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={changes => setNodes(nds => applyNodeChanges(changes, nds))}
          onEdgesChange={changes => setEdges(eds => applyEdgeChanges(changes, eds))}
          fitView
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#94A3B8" gap={20} size={1} />
          <Controls position="bottom-right" style={{ display: 'flex', gap: 4, padding: 4, background: 'white', borderRadius: 8, border: '1px solid #E2E8F0' }} />
        </ReactFlow>

        {/* --- LIVE LOGS OVERLAY --- */}
        <div style={{ 
          position: 'absolute', bottom: 24, left: 24, 
          width: 420, background: 'rgba(15, 23, 42, 0.9)', 
          color: '#F1F5F9', borderRadius: 12, padding: 16,
          backdropFilter: 'blur(8px)', 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, 
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ marginBottom: 8, color: '#94A3B8', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
             <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? '#22D3EE' : '#64748B', boxShadow: loading ? '0 0 8px #22D3EE' : 'none' }} />
             AGENT THOUGHT PROCESS
          </div>
          <div style={{ height: 90, overflowY: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4 }}>
            {logs.map((log, i) => (
              <div key={i} style={{ 
                padding: '2px 0', 
                display: 'flex', gap: 8,
                opacity: i === logs.length - 1 ? 1 : 0.5,
                transform: i === logs.length - 1 ? 'scale(1)' : 'scale(0.98)',
                transformOrigin: 'left center',
                transition: 'all 0.3s'
              }}>
                <ChevronRight size={14} color={i === logs.length - 1 ? '#22D3EE' : '#475569'} />
                {log}
              </div>
            ))}
            {logs.length === 0 && <span style={{color: '#64748B', fontStyle: 'italic'}}>Waiting for input...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}