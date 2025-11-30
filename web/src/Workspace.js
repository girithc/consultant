import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    applyNodeChanges,
    applyEdgeChanges,
    useReactFlow,
    ReactFlowProvider,
    Handle,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import {
    Sparkles,
    Loader2,
    CheckCircle2,
    BrainCircuit,
    Search,
    ChevronDown,
    ChevronUp,
    Terminal,
    FileText,
    Columns,
    Save,
    ArrowLeft,
    Trash2,
    Upload,
    Pencil,
    X
} from 'lucide-react';
import './App.css';
import LoginModal from './LoginModal';
import API_BASE_URL from './config';


/* ========================================================================
   1. CUSTOM NODE COMPONENT
   ======================================================================== */

/* ========================================================================
   1. CUSTOM NODE COMPONENT
   ======================================================================== */

const HypothesisNode = ({ id, data }) => {
    const [isNew, setIsNew] = useState(true);
    const [imageUrl, setImageUrl] = useState(null);
    const hasRequestedImage = useRef(false);

    // Local UI states
    const [mode, setMode] = useState('view'); // 'view' | 'reasoning' | 'edit'

    // Edit Form States
    const [editLabel, setEditLabel] = useState(data.label || '');
    const [editReasoning, setEditReasoning] = useState(data.reasoning || '');

    useEffect(() => {
        const timer = setTimeout(() => setIsNew(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Sync state with props if they change externally
    useEffect(() => {
        setEditLabel(data.label || '');
        setEditReasoning(data.reasoning || '');
    }, [data.label, data.reasoning]);

    // Mock Image Generation logic
    useEffect(() => {
        if (!imageUrl && data.label && !hasRequestedImage.current) {
            if (data.imageUrl) {
                setImageUrl(data.imageUrl);
                hasRequestedImage.current = true;
            } else {
                hasRequestedImage.current = true;
                // Mock image generation delay
                setTimeout(() => {
                    // Using a static placeholder that matches the aesthetic
                    setImageUrl("https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop");
                }, 1000);
            }
        }
    }, [data.label, imageUrl, data]);

    const handleSave = (e) => {
        e.stopPropagation();
        console.log('[HypothesisNode] Save clicked for node:', id, 'Text:', editLabel.substring(0, 30));
        setMode('view');

        if (window.handleNodeSave) {
            console.log('[HypothesisNode] Calling window.handleNodeSave');
            window.handleNodeSave(id, editLabel, editReasoning);
        } else if (data.onSave) {
            console.log('[HypothesisNode] Calling data.onSave');
            data.onSave(id, editLabel, editReasoning);
        } else {
            console.error('[HypothesisNode] No save handler found!');
        }
    };

    const handleCancelEdit = (e) => {
        e.stopPropagation();
        setEditLabel(data.label || '');
        setEditReasoning(data.reasoning || '');
        setMode('view');
    };

    const meta = data.meta || {};
    const isWorking = meta.status === 'working';
    const isLeaf = data.is_leaf;
    const cleanLabel = data.label?.replace(/^(Hypothesis \d+(\.\d+)*:|Sub-hypothesis \d+:|Sub-hypothesis [A-Z]:)\s*/i, '');

    // Layout Constants
    const isReasoningOpen = mode === 'reasoning';
    const isEditing = mode === 'edit';

    return (
        <div
            className="hypothesis-node"
            style={{
                position: 'relative',
                width: 300,
                minHeight: 420, // Use minHeight instead of fixed height
                height: 'auto', // Allow expansion
                borderRadius: '24px',
                background: '#000',
                boxShadow: isWorking
                    ? '0 0 0 4px rgba(59, 130, 246, 0.5), 0 20px 40px rgba(0, 0, 0, 0.6)'
                    : '0 15px 40px rgba(0, 0, 0, 0.4)',
                transition: 'all 0.3s ease',
                overflow: 'hidden',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                border: isLeaf ? '2px solid #10B981' : 'none',
                display: 'flex',
                flexDirection: 'column'
            }}>
            {/* Loading Progress Bar */}
            {isWorking && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                    background: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 20
                }}>
                    <div style={{
                        width: '50%', height: '100%',
                        background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
                        animation: 'indeterminate 1.5s infinite ease-in-out',
                        position: 'absolute', left: 0
                    }} />
                    <style>{`
                            @keyframes indeterminate {
                                0% { left: -50%; }
                                100% { left: 100%; }
                            }
                        `}</style>
                </div>

            )}
            <Handle type="target" position={Position.Top} style={{ background: '#fff', width: 10, height: 10, top: -5, border: '2px solid #0F172A' }} />

            {/* 1. Background Image */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: imageUrl ? `url(${imageUrl}) center/cover no-repeat` : 'linear-gradient(to bottom, #1e293b, #0f172a)',
                zIndex: 0,
                transition: 'filter 0.3s ease',
                filter: isEditing || isReasoningOpen ? 'blur(4px) brightness(0.5)' : 'none'
            }} />

            {/* 2. Top Badges (Visible only if not editing) */}
            {!isEditing && (
                <>
                    <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.6)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'white',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            #{data.id}
                        </div>
                    </div>

                    <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                        {isWorking && (
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.9)', color: 'white', fontSize: 10, fontWeight: 700,
                                padding: '4px 8px', borderRadius: 6, backdropFilter: 'blur(4px)'
                            }}>
                                <Loader2 size={10} className="spin" style={{ display: 'inline', marginRight: 4 }} />
                                {meta.phaseLabel || 'THINKING'}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 3. DYNAMIC GLASS PANE */}
            <div style={{
                position: 'relative', // Changed from absolute
                marginTop: 'auto',    // Push to bottom
                width: '100%',
                // Height is now driven by content

                // Frosted Glass Effect
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',

                padding: '20px',
                boxSizing: 'border-box',
                zIndex: 5,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                borderTop: isEditing ? 'none' : '1px solid rgba(255,255,255,0.1)'
            }}>

                {/* --- EDIT MODE CONTENT --- */}
                {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.3s' }}>
                        <h3 style={{ margin: 0, color: 'white', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Pencil size={16} /> Edit Hypothesis
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Hypothesis</label>
                            <textarea
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                style={{
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: 8, color: 'white', padding: 12, fontSize: 14,
                                    resize: 'none', width: '100%', height: 80, outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Reasoning</label>
                            <textarea
                                value={editReasoning}
                                onChange={(e) => setEditReasoning(e.target.value)}
                                style={{
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: 8, color: 'white', padding: 12, fontSize: 13,
                                    resize: 'none', width: '100%', height: 80, outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleCancelEdit} style={{
                                flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                                background: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 600
                            }}>
                                Cancel
                            </button>
                            <button onClick={handleSave} style={{
                                flex: 1, padding: 10, borderRadius: 8, border: 'none',
                                background: '#2563EB', color: 'white', cursor: 'pointer', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                            }}>
                                <Save size={16} /> Save & Restart
                            </button>
                        </div>
                    </div>
                ) : (
                    /* --- VIEW / REASONING MODE CONTENT --- */
                    <>
                        {/* Faded Top Border (Gradient Line) */}
                        {!isEditing && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                                zIndex: 6
                            }} />
                        )}

                        {/* Content Container */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            marginBottom: 12
                        }}>
                            {/* TITLE: No longer scrollable, expands naturally */}
                            <div style={{
                                color: 'white',
                                fontSize: isReasoningOpen ? '16px' : '20px',
                                fontWeight: 700,
                                lineHeight: '1.25',
                                letterSpacing: '-0.01em',
                                // Removed overflow/maxHeight to allow full expansion
                                transition: 'all 0.3s ease',
                                paddingRight: 4,
                                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            }}>
                                {cleanLabel}
                            </div>

                            {/* REASONING TEXT */}
                            <div style={{
                                marginTop: 16,
                                paddingTop: 16,
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                color: '#E2E8F0',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                opacity: isReasoningOpen ? 1 : 0,
                                transform: isReasoningOpen ? 'translateY(0)' : 'translateY(10px)',
                                transition: 'all 0.3s ease',
                                display: isReasoningOpen ? 'block' : 'none',
                                maxHeight: '200px', // Limit height to allow scrolling
                                overflowY: 'auto'   // Enable scrolling
                            }} className="no-scrollbar">
                                {data.reasoning || "No detailed reasoning provided."}
                            </div>
                        </div>

                        {/* Status Pills */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>

                            {isNew && (
                                <div style={{
                                    background: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.3)',
                                    padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#F9A8D4', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 4
                                }}>
                                    <Sparkles size={11} /> New
                                </div>
                            )}
                        </div>

                        {/* Bottom Buttons (Split 75/25) */}
                        <div style={{ display: 'flex', gap: 8, height: '44px', flexShrink: 0 }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setMode(isReasoningOpen ? 'view' : 'reasoning'); }}
                                style={{
                                    flex: 3,
                                    background: isReasoningOpen ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    transition: 'all 0.2s',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                onMouseLeave={e => !isReasoningOpen && (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                            >
                                <BrainCircuit size={18} />
                                {isReasoningOpen ? "Hide Reasoning" : "Reasoning"}
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); setMode('edit'); }}
                                style={{
                                    flex: 1,
                                    background: 'white',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'transform 0.1s',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                }}
                                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <Pencil size={20} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} style={{ background: '#fff', width: 10, height: 10, bottom: -5, border: '2px solid #0F172A' }} />
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
    // Increased spacing: ranksep (vertical) 150 -> 200, nodesep (horizontal) 80 -> 100
    g.setGraph({ rankdir: 'TB', ranksep: 200, nodesep: 120 });

    nodes.forEach((n) => {
        // Update dimensions to match the actual card size (300x420)
        g.setNode(n.id, { width: 300, height: 420 });
    });

    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    return {
        nodes: nodes.map((n) => {
            const pos = g.node(n.id);
            // Center the node based on its new dimensions
            return { ...n, position: { x: (pos?.x ?? 0) - 150, y: (pos?.y ?? 0) - 210 } };
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

const LogView = ({ logs, logEndRef, isCollapsed, headerHeight }) => {
    // Get the last 3 log messages, filtering out undefined/null entries
    const recentLogs = logs.filter(log => log != null && log !== undefined).slice(-3);

    return (
        <div style={{
            height: '100%',
            padding: `${isCollapsed ? 0 : headerHeight}px 24px 24px 24px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start', // Left align
            background: '#FDFCFB'
        }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0, // No gap between items, they are in one card
                width: '100%',
                maxWidth: '800px',
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                padding: '8px 0'
            }}>
                {recentLogs.length === 0 && (
                    <div style={{ padding: '16px 24px', color: '#94A3B8', fontStyle: 'italic' }}>Ready to start...</div>
                )}
                {recentLogs.map((log, i) => {
                    const cleanLog = log.replace(/^Step: /, '');
                    // Calculate opacity: older items are more transparent
                    const opacity = 0.6 + ((i + 1) / recentLogs.length) * 0.4;

                    return (
                        <div key={i + '-' + log.substring(0, 10)} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '12px 24px',
                            opacity: opacity,
                            borderBottom: i < recentLogs.length - 1 ? '1px solid #F1F5F9' : 'none',
                            transition: 'all 0.3s ease',
                            animation: 'slideInRight 0.4s ease-out forwards'
                        }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: i === recentLogs.length - 1 ? '#2563EB' : '#CBD5E1',
                                boxShadow: i === recentLogs.length - 1 ? '0 0 8px rgba(37, 99, 235, 0.4)' : 'none',
                                flexShrink: 0,
                                marginTop: 6
                            }} className={i === recentLogs.length - 1 ? "pulse-dot" : ""} />

                            <span style={{
                                fontSize: 13,
                                color: i === recentLogs.length - 1 ? '#1E293B' : '#64748B',
                                fontWeight: i === recentLogs.length - 1 ? 600 : 500,
                                lineHeight: 1.5
                            }}>
                                {cleanLog}
                            </span>
                        </div>
                    );
                })}
            </div>
            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes pulse-dot {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.8; }
                }
                .pulse-dot { animation: pulse-dot 2s infinite ease-in-out; }
            `}</style>
        </div>
    );
};

const EditModal = ({ node, onClose, onSave }) => {
    const [text, setText] = useState(node?.data?.label || '');
    const [reasoning, setReasoning] = useState(node?.data?.reasoning || '');

    if (!node) return null;

    const nodeId = node.id || node.data?.id;
    console.log('[EditModal] Node ID:', nodeId, 'Full node:', node);

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
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Edit Node {nodeId}</h3>
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
                            border: '1px solid #CBD5E1', fontSize: 14, fontFamily: 'Inter, sans-serif',
                            boxSizing: 'border-box', resize: 'vertical'
                        }}
                    />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Reasoning</label>
                    <textarea
                        value={reasoning}
                        onChange={(e) => setReasoning(e.target.value)}
                        style={{
                            width: '100%', height: 80, padding: 12, borderRadius: 8,
                            border: '1px solid #CBD5E1', fontSize: 14, fontFamily: 'Inter, sans-serif',
                            boxSizing: 'border-box', resize: 'vertical'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0',
                        background: 'white', color: '#475569', fontWeight: 500, cursor: 'pointer'
                    }}>Cancel</button>
                    <button onClick={() => {
                        console.log('[EditModal] Save clicked, calling onSave with:', nodeId, text.substring(0, 30), reasoning.substring(0, 30));
                        onSave(nodeId, text, reasoning);
                    }} style={{
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
        if (!window.confirm("Delete this document?")) return;

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
export default function Workspace({ scratchpad, onBack, user, onLogin }) {
    return (
        <ReactFlowProvider>
            <WorkspaceContent scratchpad={scratchpad} onBack={onBack} user={user} onLogin={onLogin} />
        </ReactFlowProvider>
    );
}

const WorkspaceContent = ({ scratchpad, onBack, user, onLogin }) => {
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
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

    const handleSaveWorkspace = async () => {
        if (!user) {
            setIsLoginModalOpen(true);
            return;
        }

        setSaveStatus('saving');
        try {
            // If it's a new scratchpad (id is null), create it first
            let currentScratchpadId = scratchpad.id;
            if (!currentScratchpadId) {
                const res = await fetch(`${API_BASE_URL}/scratchpads`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user.id, title: problem || "New Analysis" })
                });
                if (!res.ok) throw new Error("Failed to create scratchpad");
                const newPad = await res.json();
                currentScratchpadId = newPad.id;
                // Update local scratchpad object (in a real app, we'd update parent state)
                scratchpad.id = newPad.id;
            }

            // Save the tree
            const treeToSave = Array.from(nodesMap.current.values()).map(n => {
                const edge = Array.from(edgesMap.current.values()).find(e => e.target === n.id);
                return {
                    id: n.data.id,
                    parent_id: edge ? edge.source : "0",
                    text: n.data.label,
                    reasoning: n.data.reasoning,
                    is_leaf: n.data.is_leaf,
                    tools_used: n.data.tools_used || []
                };
            });

            // We can reuse the run_agent endpoint or create a dedicated save endpoint.
            // Since run_agent saves to CosmosDB if scratchpad_id is present, we can just trigger a save.
            // But wait, run_agent is for running the agent. We need a way to just save the state.
            // The backend has `CosmosDB().save_tree_state` but no direct endpoint for it exposed explicitly for just saving without running.
            // However, `run_agent` saves state as it runs.
            // Let's check `agent.py` again.
            // It seems we don't have a dedicated "save tree" endpoint.
            // But we DO have `CosmosDB().save_tree_state`.
            // I should probably add a save endpoint to `agent.py` or just rely on the fact that we might not need to save manually if we are not running?
            // Wait, if I am a guest, I have a tree in memory. I log in. I want to save that tree to the new scratchpad.
            // I need an endpoint to save the tree.

            // Let's assume for now I will add a save endpoint or use a workaround.
            // Actually, looking at `agent.py`, there is NO endpoint to save the tree explicitly from the frontend.
            // I should add one to `agent.py` as part of this task, or use `run_agent` with a special flag? No, that's hacky.
            // I will add `POST /scratchpads/{id}/tree` to `agent.py`.

            await fetch(`${API_BASE_URL}/scratchpads/${currentScratchpadId}/tree`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tree: treeToSave })
            });

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error("Save failed:", err);
            alert("Failed to save workspace");
            setSaveStatus('idle');
        }
    };

    const handleLoginSuccess = async (userData) => {
        onLogin(userData);
        setIsLoginModalOpen(false);
        // After login, immediately try to save
        // We need to wait for state update or just pass user data directly
        // But `user` prop won't update immediately in this closure.
        // So we'll call a modified save function or just trigger it.

        // Actually, onLogin updates App state, which re-renders Workspace with new user.
        // But we want to trigger the save *after* that.
        // For now, let's just close the modal and let the user click save again, OR auto-save.
        // Auto-save is better.

        // We can't easily auto-save here because `user` is stale.
        // We can use a ref or effect.
        // Let's just close it and maybe trigger a save with the new user data passed in.

        // Simplified: Just close modal. User sees they are logged in. They click save again.
        // Better: Pass userData to handleSaveWorkspace.
    };

    const logEndRef = useRef(null);
    const nodesMap = useRef(new Map());
    const edgesMap = useRef(new Map());
    const metaMap = useRef(new Map());
    const queue = useRef([]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Load saved tree on mount
    useEffect(() => {
        const loadSavedTree = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/scratchpads/${scratchpad.id}/tree`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.tree && data.tree.length > 0) {
                        console.log(`Loading saved tree with ${data.tree.length} nodes`);

                        // Populate nodesMap and edgesMap from saved tree
                        data.tree.forEach(h => {
                            const newNode = {
                                id: h.id,
                                type: 'hypothesis',
                                data: {
                                    id: h.id,
                                    label: h.text,
                                    reasoning: h.reasoning,
                                    is_leaf: h.is_leaf,
                                    tools_used: h.tools_used || [],
                                    onEdit: handleEditNode,
                                    onSave: handleSaveEdit
                                },
                                position: { x: 0, y: 0 }
                            };
                            nodesMap.current.set(h.id, newNode);

                            // Create edges
                            if (h.parent_id && h.parent_id !== "0") {
                                const edgeId = `e${h.parent_id}-${h.id}`;
                                edgesMap.current.set(edgeId, {
                                    id: edgeId,
                                    source: h.parent_id,
                                    target: h.id,
                                    type: 'smoothstep',
                                    animated: true,
                                    style: { stroke: '#94A3B8', strokeWidth: 2 }
                                });
                            }
                        });

                        updateGraph();
                        setLogs(prev => [...prev, `Loaded saved tree with ${data.tree.length} nodes`]);
                    }
                }
            } catch (err) {
                console.error("Failed to load saved tree:", err);
            }
        };

        loadSavedTree();
    }, [scratchpad.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            fitView({ includeHiddenNodes: true, padding: 0.2, duration: 800 });
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
        console.log('[Edit] Saving edit for node:', id, 'New text:', newText.substring(0, 50));
        setEditingNode(null);

        // Function to get all descendant IDs
        const getDescendants = (nodeId) => {
            const descendants = [];
            const queue = [nodeId];

            while (queue.length > 0) {
                const currentId = queue.shift();
                const children = Array.from(nodesMap.current.values())
                    .filter(n => {
                        const edge = Array.from(edgesMap.current.values()).find(e => e.target === n.id);
                        return edge && edge.source === currentId;
                    });

                children.forEach(child => {
                    descendants.push(child.id);
                    queue.push(child.id);
                });
            }

            return descendants;
        };

        // Remove all descendants of the edited node
        const descendantIds = getDescendants(id);
        console.log('[Edit] Removing', descendantIds.length, 'descendants:', descendantIds);
        descendantIds.forEach(descId => {
            nodesMap.current.delete(descId);
            // Remove edges connected to this descendant
            Array.from(edgesMap.current.keys()).forEach(edgeKey => {
                const edge = edgesMap.current.get(edgeKey);
                if (edge.source === descId || edge.target === descId) {
                    edgesMap.current.delete(edgeKey);
                }
            });
            metaMap.current.delete(descId);
        });

        // Update the edited node
        const node = nodesMap.current.get(id);
        if (node) {
            node.data.label = newText;
            node.data.reasoning = newReasoning;
            node.data.is_leaf = false; // Reset to not leaf so it can be broken down again
            nodesMap.current.set(id, node);
            updateGraph();
        }

        // Prepare tree for backend (only keeping nodes that weren't deleted)
        const existingTree = Array.from(nodesMap.current.values()).map(n => {
            const edge = Array.from(edgesMap.current.values()).find(e => e.target === n.id);
            return {
                id: n.data.id,
                parent_id: edge ? edge.source : "0",
                text: n.data.label,
                reasoning: n.data.reasoning,
                is_leaf: n.data.is_leaf,
                tools_used: n.data.tools_used || []
            };
        });

        console.log('[Edit] Calling generateTree with', existingTree.length, 'nodes, restart ID:', id);
        await generateTree(existingTree, id);
    };


    // Expose handleSaveEdit to window for HypothesisNode via ref to avoid dependency cycles
    const handleSaveEditRef = useRef(handleSaveEdit);
    useEffect(() => {
        handleSaveEditRef.current = handleSaveEdit;
    });

    useEffect(() => {
        window.handleNodeSave = (...args) => {
            if (handleSaveEditRef.current) {
                handleSaveEditRef.current(...args);
            }
        };
        return () => { window.handleNodeSave = null; };
    }, []);

    const handleStreamUpdate = (data) => {
        // Prioritize explicit activity from backend
        if (data.activity) {
            const { node, item_id, status } = data.activity;
            if (item_id && status === 'working') {
                let type = 'research';
                if (node.includes('breakdown')) type = 'breakdown';
                if (node.includes('classify')) type = 'classify';
                if (node.includes('formulate')) type = 'formulate';
                updateNodeStatus(item_id, type);
            }
        }

        if (data.explainability_log) {
            const logMsg = data.explainability_log[data.explainability_log.length - 1];
            setLogs(prev => [...prev, logMsg]);

            // Fallback to log parsing only if no activity data (shouldn't happen with new backend)
            if (!data.activity) {
                const { node, itemId } = parseStepLog(logMsg);
                if (node && itemId) updateNodeStatus(itemId, node);
            }
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
    };

    const generateTree = async (existingTree = null, restartNodeId = null) => {
        console.log('[generateTree] Called with existingTree:', existingTree?.length, 'restartNodeId:', restartNodeId);
        if (isCollapsed) setIsCollapsed(false);

        // Calculate next root ID regardless of mode, but only use it for new trees
        const existingRoots = Array.from(nodesMap.current.values())
            .filter(n => !n.id.includes('.'))
            .map(n => parseInt(n.id))
            .filter(id => !isNaN(id));
        const nextRootId = existingRoots.length > 0 ? Math.max(...existingRoots) + 1 : 1;

        if (!existingTree && !restartNodeId) {
            // --- NEW TREE GENERATION ---
            console.log('[generateTree] Starting NEW tree. Root offset:', nextRootId);

            // 1. Create the "Problem Node" (The Root)
            const problemNodeId = String(nextRootId);
            const problemNode = {
                id: problemNodeId,
                type: 'hypothesis', // Use same type for now, or 'problem' if we want different styling
                data: {
                    id: problemNodeId,
                    label: problem, // The problem statement itself
                    reasoning: "Root Problem Statement",
                    is_leaf: false,
                    tools_used: [],
                    onEdit: handleEditNode,
                    onSave: handleSaveEdit,
                    meta: { status: 'done', phaseLabel: 'PROBLEM' } // Mark as done immediately
                },
                position: { x: 0, y: 0 } // Layout will fix position
            };

            nodesMap.current.set(problemNodeId, problemNode);
            updateGraph(); // Show it immediately

            setLogs(prev => [...prev, `--- Starting New Hypothesis Tree (Root ${problemNodeId}) ---`]);
            setLoading(true);

            // Set up interval to process queue and create nodes
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
                            onEdit: handleEditNode,
                            onSave: handleSaveEdit
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

            try {
                const response = await fetch(`${API_BASE_URL}/run_agent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        problem_statement: problem,
                        scratchpad_id: scratchpad.id, // Will be null for guest
                        root_id_offset: nextRootId, // Offset is now the ID itself (e.g. 3)
                        parent_node_id: problemNodeId, // Tell backend to parent under this node
                        existing_tree: null, // Explicitly null
                        restart_node_id: null // Explicitly null
                    })
                });

                if (!response.ok) throw new Error('Failed to start generation');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') {
                                setLoading(false);
                                break;
                            }
                            try {
                                const data = JSON.parse(dataStr);
                                handleStreamUpdate(data);
                            } catch (e) {
                                console.error("Error parsing SSE:", e);
                            }
                        }
                    }
                }

                clearInterval(interval);

                // Process any remaining items in queue
                while (queue.current.length > 0) {
                    const h = queue.current.shift();
                    nodesMap.current.set(h.id, {
                        id: h.id, type: 'hypothesis',
                        data: {
                            id: h.id, label: h.text, reasoning: h.reasoning, is_leaf: h.is_leaf,
                            tools_used: h.tools_used,
                            onEdit: handleEditNode,
                            onSave: handleSaveEdit
                        },
                        position: { x: 0, y: 0 }
                    });
                    if (h.parent_id !== "0") edgesMap.current.set(`e${h.parent_id}-${h.id}`, {
                        id: `e${h.parent_id}-${h.id}`, source: h.parent_id, target: h.id,
                        type: 'smoothstep', animated: true, style: { stroke: '#94A3B8', strokeWidth: 2 }
                    });
                }
                updateGraph();

            } catch (err) {
                console.error(err);
                setLogs(prev => [...prev, `Error: ${err.message}`]);
                setLoading(false);
                clearInterval(interval);
            }
            return;
        }

        // --- RESTART / EDIT GENERATION ---
        console.log('[generateTree] Restarting from node:', restartNodeId);
        setLoading(true);
        // setLogs([]); // Keep logs for context

        try {
            const response = await fetch('http://localhost:8000/run_agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_statement: problem, // This might be ignored if existing_tree is passed
                    existing_tree: existingTree,
                    restart_node_id: restartNodeId,
                    scratchpad_id: scratchpad.id
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

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
                            onEdit: handleEditNode,
                            onSave: handleSaveEdit
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

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') {
                            setLoading(false);
                            break;
                        }
                        try {
                            const data = JSON.parse(dataStr);
                            handleStreamUpdate(data);
                        } catch (e) {
                            console.error("Error parsing SSE:", e);
                        }
                    }
                }
            }

            clearInterval(interval);

            // Process any remaining items in queue
            while (queue.current.length > 0) {
                const h = queue.current.shift();
                nodesMap.current.set(h.id, {
                    id: h.id, type: 'hypothesis',
                    data: {
                        id: h.id, label: h.text, reasoning: h.reasoning, is_leaf: h.is_leaf,
                        tools_used: h.tools_used,
                        onEdit: handleEditNode,
                        onSave: handleSaveEdit
                    },
                    position: { x: 0, y: 0 }
                });
                if (h.parent_id !== "0") edgesMap.current.set(`e${h.parent_id}-${h.id}`, { id: `e${h.parent_id}-${h.id}`, source: h.parent_id, target: h.id, type: 'smoothstep', animated: true, style: { stroke: '#94A3B8', strokeWidth: 2 } });
            }
            updateGraph();
        } catch (err) {
            console.error(err);
            setLogs(prev => [...prev, "Error connecting to backend."]);
            setLoading(false);
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !loading && problem.trim()) {
                                generateTree(null, null);
                            }
                        }}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
                            border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', background: loading ? '#F1F5F9' : '#F8FAFC',
                            color: loading ? '#94A3B8' : '#0F172A', cursor: loading ? 'not-allowed' : 'text'
                        }}
                        placeholder={loading ? "Hypothesis tree is being made..." : "Enter a complex business problem to solve..."}
                    />
                </div>

                <button onClick={() => generateTree(null, null)} disabled={loading} style={{
                    padding: '10px 20px', background: loading ? '#F1F5F9' : '#2563EB',
                    color: loading ? '#94A3B8' : 'white', border: 'none', borderRadius: 8,
                    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', gap: 8,
                    boxShadow: loading ? 'none' : '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}>
                    {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                    {loading ? 'Processing...' : 'Generate Strategy'}
                </button>

                <button onClick={handleSaveWorkspace} disabled={saveStatus === 'saving'} style={{
                    padding: '10px 20px', background: saveStatus === 'saved' ? '#10B981' : '#fff',
                    color: saveStatus === 'saved' ? 'white' : '#475569',
                    border: saveStatus === 'saved' ? 'none' : '1px solid #CBD5E1',
                    borderRadius: 8,
                    fontWeight: 600, cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', display: 'flex', gap: 8,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                }}>
                    {saveStatus === 'saving' ? <Loader2 size={16} className="spin" /> : (saveStatus === 'saved' ? <CheckCircle2 size={16} /> : <Save size={16} />)}
                    {saveStatus === 'saving' ? 'Saving...' : (saveStatus === 'saved' ? 'Saved' : 'Save Work')}
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

            {/* Edit Modal */}
            {editingNode && (
                <EditModal
                    node={editingNode}
                    onClose={() => setEditingNode(null)}
                    onSave={handleSaveEdit}
                />
            )}

            {isLoginModalOpen && (
                <LoginModal
                    onClose={() => setIsLoginModalOpen(false)}
                    onLogin={handleLoginSuccess}
                />
            )}
        </div>
    );
}
