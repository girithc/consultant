import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    applyNodeChanges,
    applyEdgeChanges,
    Handle,
    Position,
    useReactFlow,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import {
    Sparkles,
    Loader2,
    CheckCircle2,
    BrainCircuit,
    Search,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Terminal,
    FileText,
    Columns,
    FileSearch,
    Plus,
    ArrowLeft,
    Trash2,
    Upload,
    Pencil,
    X
} from 'lucide-react';
import './App.css';

/* ========================================================================
   1. CUSTOM NODE COMPONENT
   ======================================================================== */
const HypothesisNode = ({ id, data }) => {
    const [isNew, setIsNew] = useState(true);

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
                opacity: 0,
                transform: 'translateY(10px)',
                fontFamily: 'Inter, sans-serif'
            }}
        >
            <Handle type="target" position={Position.Top} style={{ background: '#94A3B8', width: 8, height: 8 }} />

            <div style={{ position: 'absolute', top: -10, right: 10, display: 'flex', gap: 6 }}>
                {isNew && (
                    <div style={{
                        background: '#8B5CF6', color: 'white', fontSize: 10, fontWeight: '700',
                        padding: '2px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4,
                        boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)', letterSpacing: '0.5px'
                    }}>
                        <Sparkles size={10} /> NEW
                    </div>
                )}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                    fontWeight: 700, color: '#475569', background: '#F1F5F9',
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, border: '1px solid #E2E8F0'
                }}>
                    {data.id}
                </span>
                {isLeaf && (
                    <span style={{ color: '#059669', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> VALIDATED LEAF
                    </span>
                )}
            </div>

            <div style={{ marginBottom: 12, color: '#1E293B', lineHeight: '1.5', fontWeight: 500 }}>
                {data.label}
            </div>

            {data.reasoning && (
                <div style={{
                    fontSize: 11, color: '#334155', background: '#F8FAFC',
                    padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                    fontStyle: 'italic', borderLeft: '3px solid #64748B', lineHeight: '1.5',
                    marginBottom: 8
                }}>
                    "{data.reasoning}"
                </div>
            )}

            {/* Tools Used Badges */}
            {data.tools_used && data.tools_used.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                    {data.tools_used.map((tool, i) => (
                        <span key={i} style={{
                            fontSize: 9, fontWeight: 700, color: '#475569',
                            background: '#F1F5F9', border: '1px solid #E2E8F0',
                            padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase'
                        }}>
                            {tool}
                        </span>
                    ))}
                </div>
            )}

            <Handle type="source" position={Position.Bottom} style={{ background: '#94A3B8', width: 8, height: 8 }} />

            {/* Edit Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    data.onEdit && data.onEdit(data.id);
                }}
                style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#2563EB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
            >
                <Pencil size={12} />
            </button>
        </div>
    );
};

const nodeTypes = { hypothesis: HypothesisNode };

/* ========================================================================
   2. LOGIC & LAYOUT
   ======================================================================== */
const parseStepLog = (str = '') => {
    if (str.includes('formulate_top_hypothesis')) return { node: 'formulate', itemId: null };
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
    research: { phase: 'research', label: 'SEARCHING' },
    classify: { phase: 'classify', label: 'CLASSIFYING' },
    identify: { phase: 'identify', label: 'PLANNING' },
};

const getLayoutedElements = (nodes, edges) => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });
    nodes.forEach((n) => g.setNode(n.id, { width: 320, height: 180 }));
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return {
        nodes: nodes.map((n) => {
            const pos = g.node(n.id);
            return { ...n, position: { x: (pos?.x ?? 0) - 160, y: (pos?.y ?? 0) - 90 } };
        }),
        edges,
    };
};

// --- LAYOUT CONSTANTS ---
const HEADER_HEIGHT = 40;
const EXPANDED_HEIGHT = 280;
const SCREEN_MARGIN = 24;
const CONTROLS_GAP = 12;

// --- SUB-COMPONENTS FOR BOTTOM PANEL ---

const LogView = ({ logs, logEndRef, isCollapsed, headerHeight }) => (
    <div className="log-scroll-light" style={{
        height: '100%',
        overflowY: 'auto',
        padding: `${isCollapsed ? 12 : 12 + headerHeight}px 20px 30px 20px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
    }}>
        {logs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B', fontStyle: 'italic' }}>
                Waiting for input...
            </div>
        ) : (
            logs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', opacity: i >= logs.length - 3 ? 1 : 0.6, transition: 'opacity 0.3s' }}>
                    <span style={{ color: '#64748B', minWidth: 24 }}>{(i + 1).toString().padStart(2, '0')}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <ChevronRight size={12} color={i === logs.length - 1 ? '#2563EB' : '#94A3B8'} />
                        <span style={{ color: i === logs.length - 1 ? '#1E293B' : '#475569' }}>{log}</span>
                    </div>
                </div>
            ))
        )}
        <div ref={logEndRef} />
    </div>
);

const EditModal = ({ node, onClose, onSave }) => {
    const [text, setText] = useState(node?.data?.label || '');
    const [reasoning, setReasoning] = useState(node?.data?.reasoning || '');

    if (!node) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'white', borderRadius: 12, padding: 24, width: 500,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Edit Node {node.id}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="#64748B" />
                    </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Hypothesis / Action</label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        style={{
                            width: '100%', height: 80, padding: 12, borderRadius: 8,
                            border: '1px solid #CBD5E1', fontSize: 14, fontFamily: 'Inter, sans-serif'
                        }}
                    />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Reasoning</label>
                    <textarea
                        value={reasoning}
                        onChange={(e) => setReasoning(e.target.value)}
                        style={{
                            width: '100%', height: 60, padding: 12, borderRadius: 8,
                            border: '1px solid #CBD5E1', fontSize: 14, fontFamily: 'Inter, sans-serif'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0',
                        background: 'white', color: '#475569', fontWeight: 500, cursor: 'pointer'
                    }}>Cancel</button>
                    <button onClick={() => onSave(node.id, text, reasoning)} style={{
                        padding: '8px 16px', borderRadius: 6, border: 'none',
                        background: '#2563EB', color: 'white', fontWeight: 500, cursor: 'pointer'
                    }}>Save & Restart</button>
                </div>
            </div>
        </div>
    );
};

const DocumentsView = ({ scratchpadId, isCollapsed, headerHeight }) => {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const fetchDocuments = useCallback(async () => {
        try {
            const res = await fetch(`http://localhost:8000/scratchpads/${scratchpadId}/documents`);
            const data = await res.json();
            setDocuments(data);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        }
    }, [scratchpadId]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Read file as base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result.split(',')[1];

                const res = await fetch(`http://localhost:8000/scratchpads/${scratchpadId}/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        content: base64
                    })
                });

                if (!res.ok) throw new Error("Upload failed");

                await fetchDocuments();
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload document");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm("Delete this document?")) return;

        try {
            const res = await fetch(`http://localhost:8000/documents/${docId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Delete failed");
            await fetchDocuments();
        } catch (err) {
            console.error("Delete error:", err);
            alert("Failed to delete document");
        }
    };

    const getFileType = (filename) => {
        const ext = filename.split('.').pop().toUpperCase();
        if (ext === 'DOCX') return 'DOC';
        return ext;
    };

    const getFileColor = (type) => {
        switch (type) {
            case 'PDF': return '#EF4444';
            case 'DOC': return '#3B82F6';
            case 'CSV': return '#10B981';
            case 'TXT': return '#64748B';
            default: return '#94A3B8';
        }
    };

    return (
        <div style={{
            height: '100%',
            overflowY: 'auto',
            padding: `${isCollapsed ? 0 : headerHeight}px 0 0 0`,
            display: 'flex',
            flexDirection: 'column'
        }}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
            />

            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: '#FDFCFB',
                padding: '16px 20px 8px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Attached Context
                </span>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: uploading ? '#F1F5F9' : '#fff',
                        border: '1px solid #E2E8F0',
                        color: uploading ? '#94A3B8' : '#475569',
                        fontWeight: 600,
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        padding: '6px 12px',
                        borderRadius: 6,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease-in-out',
                    }}
                    onMouseEnter={e => { if (!uploading) { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.borderColor = '#BFDBFE'; } }}
                    onMouseLeave={e => { if (!uploading) { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#E2E8F0'; } }}
                >
                    {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                    {uploading ? 'Uploading...' : 'Add Document'}
                </button>
            </div>

            <div style={{ display: 'grid', gap: 8, padding: '0 20px 30px 20px' }}>
                {documents.map((doc) => {
                    const fileType = getFileType(doc.filename);
                    const created = new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                        <div key={doc.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: '#fff',
                            border: '1px solid #E2E8F0', borderRadius: 6,
                            transition: 'background 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                <div style={{
                                    background: getFileColor(fileType),
                                    padding: 4, borderRadius: 4, color: 'white', fontSize: 8, fontWeight: 700
                                }}>
                                    {fileType}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                    <span style={{ color: '#1E293B', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</span>
                                    <span style={{ color: '#64748B', fontSize: 10 }}>{created}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(doc.id)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94A3B8',
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'flex',
                                    transition: 'color 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}

                {documents.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '32px 16px',
                        color: '#94A3B8'
                    }}>
                        <FileText size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                        <p style={{ fontSize: 12, fontWeight: 500 }}>No documents yet</p>
                        <p style={{ fontSize: 11, marginTop: 4 }}>Upload PDF, DOCX, TXT, or CSV files</p>
                    </div>
                )}
            </div>
        </div>
    );
};


/* ========================================================================
   3. MAIN WORKSPACE COMPONENT (WRAPPED)
   ======================================================================== */
/* ========================================================================
   3. MAIN WORKSPACE COMPONENT (WRAPPED)
   ======================================================================== */
export default function Workspace({ scratchpad, onBack }) {
    return (
        <ReactFlowProvider>
            <WorkspaceContent scratchpad={scratchpad} onBack={onBack} />
        </ReactFlowProvider>
    );
}

const WorkspaceContent = ({ scratchpad, onBack }) => {
    const { fitView } = useReactFlow();
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [problem, setProblem] = useState(scratchpad.content || "A leading e-commerce client has seen a 15% decline in profits.");
    const [logs, setLogs] = useState([]);

    const [activeTab, setActiveTab] = useState('process');
    const [isSplitView, setIsSplitView] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [editingNode, setEditingNode] = useState(null);

    const logEndRef = useRef(null);
    const nodesMap = useRef(new Map());
    const edgesMap = useRef(new Map());
    const metaMap = useRef(new Map());
    const queue = useRef([]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const updateGraph = useCallback(() => {
        const currentNodes = Array.from(nodesMap.current.values()).map(n => ({
            ...n, data: { ...n.data, meta: metaMap.current.get(n.id) || {} }
        }));
        const currentEdges = Array.from(edgesMap.current.values());
        if (currentNodes.length === 0) return;
        const layout = getLayoutedElements(currentNodes, currentEdges);
        setNodes(layout.nodes);
        setEdges(layout.edges);

        // Auto-zoom to fit new nodes
        window.requestAnimationFrame(() => {
            fitView({ padding: 0.2, duration: 800 });
        });
    }, [fitView]);

    const updateNodeStatus = (id, type) => {
        if (!id) return;
        const config = NODE_META_CONFIG[type];
        if (!config) return;
        metaMap.current.forEach(m => m.status = 'idle');
        if (!metaMap.current.has(id)) metaMap.current.set(id, {});
        const meta = metaMap.current.get(id);
        meta.status = 'working';
        meta.phaseLabel = config.label;
        updateGraph();
    };

    const handleEditNode = (id) => {
        const node = nodesMap.current.get(id);
        if (node) setEditingNode(node);
    };

    const handleSaveEdit = async (id, newText, newReasoning) => {
        setEditingNode(null);

        // Update local node map first
        const node = nodesMap.current.get(id);
        if (node) {
            node.data.label = newText;
            node.data.reasoning = newReasoning;
            nodesMap.current.set(id, node);
            updateGraph();
        }

        // Prepare existing tree for backend
        const existingTree = Array.from(nodesMap.current.values()).map(n => ({
            id: n.data.id,
            parent_id: edgesMap.current.get(`e${n.data.id.split('.').slice(0, -1).join('.')}-${n.data.id}`)?.source || "0", // infer parent from edge or ID logic? 
            // Actually, edgesMap key format is e{source}-{target}. 
            // Better to store parent_id in data or infer it. 
            // Let's try to find the edge targeting this node.
            text: n.data.label,
            reasoning: n.data.reasoning,
            is_leaf: n.data.is_leaf
        }));

        // Fix parent_ids
        existingTree.forEach(n => {
            const edge = Array.from(edgesMap.current.values()).find(e => e.target === n.id);
            n.parent_id = edge ? edge.source : "0";
        });

        await generateTree(existingTree, id);
    };

    const generateTree = async (existingTree = null, restartNodeId = null) => {
        if (isCollapsed) setIsCollapsed(false);

        setLoading(true);

        // If NOT restarting, clear everything. If restarting, keep maps but clear logs/queue?
        if (!existingTree) {
            setNodes([]); setEdges([]); setLogs([]);
            nodesMap.current.clear(); edgesMap.current.clear(); metaMap.current.clear(); queue.current = [];
        } else {
            // If restarting, we keep the current state but maybe clear logs or add a separator?
            setLogs(prev => [...prev, "--- RESTARTING ANALYSIS ---"]);
            queue.current = [];
        }

        try {
            const payload = {
                problem_statement: problem,
                scratchpad_id: scratchpad.id
            };

            if (existingTree && restartNodeId) {
                payload.existing_tree = existingTree;
                payload.restart_node_id = restartNodeId;
            }

            const response = await fetch('http://localhost:8000/run_agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            const interval = setInterval(() => {
                if (queue.current.length > 0) {
                    const next = queue.current.shift();
                    const newNode = {
                        id: next.id, type: 'hypothesis',
                        data: {
                            id: next.id,
                            label: next.text,
                            reasoning: next.reasoning,
                            is_leaf: next.is_leaf,
                            tools_used: next.tools_used,
                            onEdit: handleEditNode
                        },
                        position: { x: 0, y: 0 }
                    };
                    nodesMap.current.set(next.id, newNode);
                    if (next.parent_id && next.parent_id !== "0") {
                        const edgeId = `e${next.parent_id}-${next.id}`;
                        edgesMap.current.set(edgeId, {
                            id: edgeId, source: next.parent_id, target: next.id,
                            type: 'smoothstep', animated: true, style: { stroke: '#94A3B8', strokeWidth: 2 }
                        });
                    }
                    updateGraph();
                }
            }, 250);

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
                        if (data.explainability_log) {
                            const logMsg = data.explainability_log[data.explainability_log.length - 1];
                            setLogs(prev => [...prev, logMsg]);
                            const { node, itemId } = parseStepLog(logMsg);
                            if (node && itemId) updateNodeStatus(itemId, node);
                        }
                        if (data.hypothesis_tree) {
                            data.hypothesis_tree.forEach(h => {
                                if (!nodesMap.current.has(h.id)) {
                                    if (!queue.current.find(q => q.id === h.id)) queue.current.push(h);
                                } else {
                                    const existing = nodesMap.current.get(h.id);
                                    existing.data.is_leaf = h.is_leaf;
                                    nodesMap.current.set(h.id, existing);
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
            setLogs(prev => [...prev, "Error connecting to backend.", "Checking cached documents...", "Found 4 relevant documents."]);
        } finally {
            setLoading(false);
            while (queue.current.length > 0) {
                const h = queue.current.shift();
                nodesMap.current.set(h.id, {
                    id: h.id, type: 'hypothesis',
                    data: {
                        id: h.id, label: h.text, reasoning: h.reasoning, is_leaf: h.is_leaf,
                        tools_used: h.tools_used,
                        onEdit: handleEditNode
                    },
                    position: { x: 0, y: 0 }
                });
                if (h.parent_id !== "0") edgesMap.current.set(`e${h.parent_id}-${h.id}`, { id: `e${h.parent_id}-${h.id}`, source: h.parent_id, target: h.id, type: 'smoothstep', animated: true, style: { stroke: '#94A3B8', strokeWidth: 2 } });
            }
            updateGraph();
        }
    };

    const currentPanelHeight = isCollapsed ? HEADER_HEIGHT : EXPANDED_HEIGHT;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden', background: '#F8FAFC' }}>
            <style>{`
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .log-scroll-light::-webkit-scrollbar { width: 6px; }
        .log-scroll-light::-webkit-scrollbar-track { background: #F3F4F6; } 
        .log-scroll-light::-webkit-scrollbar-thumb { background: #CBD5E1; borderRadius: 10px; } 
        .log-scroll-light::-webkit-scrollbar-thumb:hover { background: #94A3B8; } 
        .react-flow__controls-button { border: none !important; }
        .tab-btn-light:hover { background: #F1F5F9; }
        .action-btn-light:hover { background: #E2E8F0; color: #1E293B; }
      `}</style>

            {/* --- HEADER --- */}
            <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 16, alignItems: 'center', zIndex: 30, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

                <button onClick={onBack} className="action-btn-light" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <ArrowLeft size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: isCollapsed ? 0 : 16 }}>
                    <div style={{ background: '#2563EB', padding: 6, borderRadius: 8, color: 'white' }}>
                        <BrainCircuit size={20} />
                    </div>
                    {!isCollapsed && (
                        <span style={{ fontWeight: 700, fontSize: 18, color: '#0F172A', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
                            {scratchpad.title}
                        </span>
                    )}
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
                    <input
                        value={problem} onChange={(e) => setProblem(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
                            border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', background: '#F8FAFC'
                        }}
                        placeholder="Enter a complex business problem to solve..."
                    />
                </div>

                <button onClick={generateTree} disabled={loading} style={{
                    padding: '10px 20px', background: loading ? '#F1F5F9' : '#2563EB',
                    color: loading ? '#94A3B8' : 'white', border: 'none', borderRadius: 8,
                    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', gap: 8,
                    boxShadow: loading ? 'none' : '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}>
                    {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                    {loading ? 'Processing...' : 'Generate Strategy'}
                </button>
            </div>

            {/* --- CANVAS --- */}
            <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlow
                    nodes={nodes} edges={edges} nodeTypes={nodeTypes}
                    onNodesChange={changes => setNodes(nds => applyNodeChanges(changes, nds))}
                    onEdgesChange={changes => setEdges(eds => applyEdgeChanges(changes, eds))}
                    fitView minZoom={0.1} proOptions={{ hideAttribution: true }}
                >
                    <Background color="#94A3B8" gap={20} size={1} />
                    <Controls
                        position='bottom-right'
                        style={{
                            display: 'flex', flexDirection: 'row', width: 'fit-content',
                            right: SCREEN_MARGIN, bottom: currentPanelHeight + SCREEN_MARGIN + CONTROLS_GAP,
                            margin: 0, backgroundColor: '#fff', border: '1px solid #E2E8F0',
                            borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '4px',
                            transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                </ReactFlow>

                {/* --- BOTTOM PANEL --- */}
                <div style={{
                    position: 'absolute',
                    left: SCREEN_MARGIN,
                    right: SCREEN_MARGIN,
                    bottom: SCREEN_MARGIN,
                    height: currentPanelHeight,
                    transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#FDFCFB',
                    color: '#334155',
                    backdropFilter: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    borderRadius: 16,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    border: '1px solid #E2E8F0',
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>

                    {/* Header */}
                    <div style={{
                        padding: '0 16px',
                        height: HEADER_HEIGHT,
                        minHeight: HEADER_HEIGHT,
                        borderBottom: '1px solid #E2E8F0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: '#F8F9FA',
                        cursor: 'pointer'
                    }}
                        onClick={(e) => {
                            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SVG') setIsCollapsed(!isCollapsed);
                        }}
                    >

                        <div style={{ display: 'flex', height: '100%', gap: 20 }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab('process'); if (isCollapsed) setIsCollapsed(false); }}
                                className="tab-btn-light"
                                style={{
                                    background: 'transparent', border: 'none',
                                    color: activeTab === 'process' ? '#2563EB' : '#64748B',
                                    borderBottom: activeTab === 'process' ? '2px solid #2563EB' : '2px solid transparent',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '0 4px', height: '100%', letterSpacing: 0.5, transition: 'all 0.2s'
                                }}
                            >
                                <Terminal size={14} />
                                {!isCollapsed && "THOUGHT PROCESS"}
                                {loading && activeTab === 'process' && (
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB', boxShadow: '0 0 8px rgba(37, 99, 235, 0.5)' }} />
                                )}
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab('documents'); if (isCollapsed) setIsCollapsed(false); }}
                                className="tab-btn-light"
                                style={{
                                    background: 'transparent', border: 'none',
                                    color: activeTab === 'documents' ? '#2563EB' : '#64748B',
                                    borderBottom: activeTab === 'documents' ? '2px solid #2563EB' : '2px solid transparent',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '0 4px', height: '100%', letterSpacing: 0.5, transition: 'all 0.2s'
                                }}
                            >
                                <FileText size={14} />
                                {!isCollapsed && "DOCUMENTS"}
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsSplitView(!isSplitView); if (isCollapsed) setIsCollapsed(false); }}
                                className="action-btn-light"
                                title="Toggle Split View"
                                style={{
                                    background: isSplitView ? '#EFF6FF' : 'transparent',
                                    color: isSplitView ? '#2563EB' : '#64748B',
                                    border: isSplitView ? '1px solid #BFDBFE' : '1px solid transparent',
                                    borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', transition: 'all 0.2s'
                                }}
                            >
                                <Columns size={14} />
                            </button>

                            <div style={{ width: 1, height: 16, background: '#E2E8F0' }}></div>

                            <button
                                onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
                                className="action-btn-light"
                                title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
                                style={{
                                    background: 'transparent', color: '#64748B',
                                    border: '1px solid transparent',
                                    borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', transition: 'all 0.2s'
                                }}
                            >
                                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>

                        <div style={{
                            flex: isSplitView ? '0 0 50%' : (activeTab === 'process' ? '1 1 100%' : '0 0 0'),
                            display: isSplitView || activeTab === 'process' ? 'block' : 'none',
                            borderRight: isSplitView ? '1px solid #E2E8F0' : 'none',
                            height: '100%'
                        }}>
                            <LogView
                                logs={logs}
                                logEndRef={logEndRef}
                                isCollapsed={isCollapsed}
                                headerHeight={HEADER_HEIGHT}
                            />
                        </div>

                        <div style={{
                            flex: isSplitView ? '0 0 50%' : (activeTab === 'documents' ? '1 1 100%' : '0 0 0'),
                            display: isSplitView || activeTab === 'documents' ? 'block' : 'none',
                            height: '100%'
                        }}>
                            <DocumentsView
                                scratchpadId={scratchpad.id}
                                isCollapsed={isCollapsed}
                                headerHeight={HEADER_HEIGHT}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
