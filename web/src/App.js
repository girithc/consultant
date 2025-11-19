import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

/* =========================
   Node UI with working badge + timings
========================= */
const HypothesisNode = ({ id, data }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    id: data.id || id,
    label: data.label || '',
    reasoning: data.reasoning || '',
  });

  useEffect(() => {
    setDraft({ id: data.id || id, label: data.label || '', reasoning: data.reasoning || '' });
  }, [data.id, data.label, data.reasoning, id]);

  const startEdit = () => setEditing(true);
  const cancelEdit = () => { setEditing(false); setDraft({ id: data.id, label: data.label, reasoning: data.reasoning }); };
  const saveEdit = () => { setEditing(false); data.onEdit?.(id, { id: draft.id.trim() || id, label: draft.label, reasoning: draft.reasoning }); };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') return cancelEdit();
    const confirm = e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.target.tagName === 'INPUT');
    if (confirm) { e.preventDefault(); saveEdit(); }
  };

  const meta = data.meta || {};
  const fmtMs = (ms) => (ms == null ? null : (ms / 1000).toFixed(1) + 's');

  return (
    <div
      onDoubleClick={startEdit}
      style={{
        position: 'relative',
        padding: 12,
        border: '1px solid #DFE3E8',
        borderRadius: 8,
        background: '#fff',
        minWidth: 260,
        maxWidth: 360,
        fontSize: 12,
        boxShadow: '0 2px 6px rgba(16,24,40,0.06)',
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* WORKING BADGE (top-right) */}
      {meta.status === 'working' && (
        <div
          style={{
            position: 'absolute', top: 6, right: 6,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', borderRadius: 999,
            background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF',
            fontSize: 11, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: 999, background: '#1E40AF',
              animation: 'pulse 1.2s ease-in-out infinite',
            }}
          />
          <span>{meta.phaseLabel || 'Working…'}</span>
        </div>
      )}

      {!editing ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, color: '#111827' }}>{data.id}</div>
            <button onClick={startEdit} style={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 6, padding: '2px 6px', background: '#F9FAFB', cursor: 'pointer' }}>Edit</button>
          </div>
          <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap', color: '#111827' }}>{data.label}</div>
          {data.reasoning && (
            <div style={{ fontStyle: 'italic', color: '#4B5563', background: '#F3F4F6', padding: 8, borderRadius: 6, border: '1px dashed #E5E7EB' }}>
              “{(data.reasoning || '').substring(0, 120)}{(data.reasoning || '').length > 120 ? '…' : ''}”
            </div>
          )}
        </>
      ) : (
        <div onKeyDown={onKeyDown}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>ID</label>
          <input value={draft.id} onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))} style={{ width: '100%', marginBottom: 8, padding: 6, border: '1px solid #D1D5DB', borderRadius: 6 }} />
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Label</label>
          <textarea value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} rows={3} style={{ width: '100%', marginBottom: 8, padding: 6, border: '1px solid #D1D5DB', borderRadius: 6, resize: 'vertical' }} />
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Reasoning</label>
          <textarea value={draft.reasoning} onChange={(e) => setDraft((d) => ({ ...d, reasoning: e.target.value }))} rows={3} style={{ width: '100%', marginBottom: 8, padding: 6, border: '1px solid #D1D5DB', borderRadius: 6, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancelEdit} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveEdit} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      )}

      {/* TIMINGS (footer) */}
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {fmtMs(meta.createdMs) && (
          <Chip label={`Created in ${fmtMs(meta.createdMs)}`} color="#065F46" bg="#ECFDF5" border="#A7F3D0" />
        )}
        {fmtMs(meta.researchMs) && (
          <Chip label={`Research ${fmtMs(meta.researchMs)}`} color="#1E40AF" bg="#EFF6FF" border="#BFDBFE" />
        )}
        {fmtMs(meta.classifyMs) && (
          <Chip label={`Classify ${fmtMs(meta.classifyMs)}`} color="#1E3A8A" bg="#E0E7FF" border="#C7D2FE" />
        )}
        {fmtMs(meta.identifyMs) && (
          <Chip label={`Identify ${fmtMs(meta.identifyMs)}`} color="#7C2D12" bg="#FFEDD5" border="#FED7AA" />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

function Chip({ label, color, bg, border }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', borderRadius: 999, border: `1px solid ${border}`,
      background: bg, color, fontSize: 11,
    }}>
      {label}
    </div>
  );
}

const nodeTypes = { hypothesis: HypothesisNode };

/* =========================
   Step mapping + parsers
========================= */
const edgeKey = (s, t) => `e${s}-${t}`;

const NODE_META = {
  formulate_top_hypothesis: { phase: 'research', label: 'Strategist — Web search' },
  breakdown_hypothesis: { phase: 'research', label: 'Strategist — Web search' },
  classify_hypothesis: { phase: 'classify', label: 'Researcher — Classifying' },
  identify_analysis: { phase: 'identify', label: 'Researcher — Identifying analysis' },
};

function parseStepLog(str = '') {
  // Matches: "Step completed: node_name", optionally with "for 1.2.3"
  const m = str.match(/Step(?: completed)?:\s*([a-zA-Z_]+)(?:.*?\sfor\s([\d.]+))?/);
  if (!m) return { node: null, itemId: null };
  return { node: m[1], itemId: m[2] || null };
}

function layout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 90, nodesep: 60, edgesep: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: 320, height: 160 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const outNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: (pos?.x ?? 0) - 160, y: (pos?.y ?? 0) - 80 } };
  });

  return { nodes: outNodes, edges };
}

/* =========================
   Main App
========================= */
export default function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('Why are sales declining?');

  const controllerRef = useRef(null);
  const nodesByIdRef = useRef(new Map());      // id -> RF node
  const edgesByIdRef = useRef(new Map());      // ek -> RF edge
  const rafRef = useRef(null);

  // meta per node id: timings & statuses
  const nodeMetaRef = useRef(new Map());       // id -> {createdAt, createdMs, status, phase, phaseLabel, phaseStartedAt, researchMs, classifyMs, identifyMs}
  const activityItemRef = useRef(null);        // {id, phase, startedAt}

  const flush = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const arrNodes = Array.from(nodesByIdRef.current.values()).map((n) => {
        const meta = nodeMetaRef.current.get(n.id) || {};
        return { ...n, data: { ...n.data, meta } };
      });
      const arrEdges = Array.from(edgesByIdRef.current.values());
      const { nodes: ln, edges: le } = layout(arrNodes, arrEdges);
      setNodes(ln); setEdges(le);
    });
  }, []);

  const ensureMeta = useCallback((id) => {
    if (!nodeMetaRef.current.has(id)) {
      nodeMetaRef.current.set(id, {
        createdAt: null,
        createdMs: null,
        status: 'idle',
        phase: null,
        phaseLabel: null,
        phaseStartedAt: null,
        researchMs: null,
        classifyMs: null,
        identifyMs: null,
      });
    }
    return nodeMetaRef.current.get(id);
  }, []);

  const setPhase = useCallback((id, nodeName) => {
    const metaDef = NODE_META[nodeName];
    if (!metaDef) return;
    const meta = ensureMeta(id);

    // close previous phase if any
    if (meta.phase && meta.phaseStartedAt) {
      const elapsed = Date.now() - meta.phaseStartedAt;
      if (meta.phase === 'research') meta.researchMs = (meta.researchMs || 0) + elapsed;
      if (meta.phase === 'classify') meta.classifyMs = (meta.classifyMs || 0) + elapsed;
      if (meta.phase === 'identify') meta.identifyMs = (meta.identifyMs || 0) + elapsed;
    }

    // start new phase
    meta.status = 'working';
    meta.phase = metaDef.phase;
    meta.phaseLabel = metaDef.label;
    meta.phaseStartedAt = Date.now();
    nodeMetaRef.current.set(id, meta);
    flush();
  }, [ensureMeta, flush]);

  const finishPhase = useCallback((id) => {
    const meta = ensureMeta(id);
    if (meta.phase && meta.phaseStartedAt) {
      const elapsed = Date.now() - meta.phaseStartedAt;
      if (meta.phase === 'research') meta.researchMs = (meta.researchMs || 0) + elapsed;
      if (meta.phase === 'classify') meta.classifyMs = (meta.classifyMs || 0) + elapsed;
      if (meta.phase === 'identify') meta.identifyMs = (meta.identifyMs || 0) + elapsed;
    }
    meta.status = 'idle';
    meta.phase = null;
    meta.phaseLabel = null;
    meta.phaseStartedAt = null;
    nodeMetaRef.current.set(id, meta);
    flush();
  }, [ensureMeta, flush]);

  const noteCreationIfNeeded = useCallback((id) => {
    const meta = ensureMeta(id);
    if (meta.createdAt == null) {
      meta.createdAt = Date.now();
      // If we started work on this id earlier (activityItemRef), set createdMs as time from that start to now
      if (activityItemRef.current?.id === id && activityItemRef.current.startedAt) {
        meta.createdMs = Date.now() - activityItemRef.current.startedAt;
      } else {
        meta.createdMs = 0; // appears immediately; will be small if start unknown
      }
      nodeMetaRef.current.set(id, meta);
    }
  }, [ensureMeta]);

  const upsertHypothesis = useCallback((h) => {
    const id = h.id ?? h['id'];
    if (!id) return;
    const parent_id = h.parent_id ?? h['parent_id'];
    const text = h.text ?? h['text'];
    const reasoning = h.reasoning ?? h['reasoning'];

    noteCreationIfNeeded(id);

    const existing = nodesByIdRef.current.get(id);
    const node = {
      id,
      type: 'hypothesis',
      data: { id, label: text, reasoning, onEdit: () => {} },
      position: existing?.position || { x: 0, y: 0 },
    };
    nodesByIdRef.current.set(id, node);

    if (parent_id && parent_id !== '0') {
      const ek = edgeKey(parent_id, id);
      if (!edgesByIdRef.current.has(ek)) {
        edgesByIdRef.current.set(ek, { id: ek, source: parent_id, target: id, type: 'smoothstep' });
      }
    }
    flush();
  }, [flush, noteCreationIfNeeded]);

  const generateTree = async () => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    // reset state
    setLoading(true);
    setNodes([]); setEdges([]);
    nodesByIdRef.current = new Map();
    edgesByIdRef.current = new Map();
    nodeMetaRef.current = new Map();
    activityItemRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null;

    try {
      const res = await fetch('http://localhost:8000/run_agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_statement: problem }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split('\n');
        buffered = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '{}') continue;

          let payload;
          try { payload = JSON.parse(trimmed); } catch { continue; }

          // 1) Interpret logs to set working phase + item
          const logs = payload.explainability_log || [];
          if (logs.length) {
            const last = logs[logs.length - 1];
            const { node, itemId } = parseStepLog(last);
            if (node) {
              const metaDef = NODE_META[node];
              if (metaDef) {
                // Start tracking this item
                if (itemId) {
                  activityItemRef.current = { id: itemId, phase: metaDef.phase, startedAt: Date.now() };
                  // if tile already exists, set phase; if not, when it appears noteCreationIfNeeded() will capture createdMs
                  setPhase(itemId, node);
                }
              }
            }
          }

          // 2) When a node completes, close phase timing
          if (payload.last_completed_item_id) {
            finishPhase(payload.last_completed_item_id);
          }

          // 3) Apply graph updates
          const list = payload.hypothesis_tree || [];
          for (const h of list) upsertHypothesis(h);
        }
      }

      // no special finalization needed
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('stream error:', err);
        alert('Failed to connect to backend on :8000');
      }
    } finally {
      setLoading(false);
      controllerRef.current = null;
      flush();
    }
  };

  useEffect(() => () => {
    if (controllerRef.current) controllerRef.current.abort();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const defaultEdgeOptions = useMemo(() => ({ type: 'smoothstep' }), []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ padding: 16, background: '#F8FAFC', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E7EB', outline: 'none', fontSize: 14 }}
          placeholder="Describe the problem to analyze…"
        />
        <button
          onClick={generateTree}
          disabled={loading}
          style={{ padding: '10px 16px', background: loading ? '#CBD5E1' : '#2563EB', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Thinking…' : 'Generate Strategy'}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(c) => setNodes((nds) => applyNodeChanges(c, nds))}
          onEdgesChange={(c) => setEdges((eds) => applyEdgeChanges(c, eds))}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <Background gap={16} size={1} />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>

      {/* Minimal global status */}
      <div style={{
        position: 'fixed', left: 12, bottom: 12, zIndex: 50,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 999,
        background: '#111827', color: 'white', fontSize: 12,
        boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999, background: 'white',
          animation: 'pulse 1.2s ease-in-out infinite'
        }} />
        {loading ? 'Working…' : 'Idle'}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
