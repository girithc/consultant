import React, { useState, useEffect, useCallback } from 'react';
import { Plus, LogOut, BrainCircuit, FolderOpen, Calendar } from 'lucide-react';
import API_BASE_URL from './config';
import './App.css';

function Dashboard({ user, onSelectScratchpad, onLogout }) {
    const [scratchpads, setScratchpads] = useState([]);
    const [newTitle, setNewTitle] = useState('');

    const fetchScratchpads = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/scratchpads/${user.id}`);
            const data = await res.json();
            setScratchpads(data);
        } catch (err) {
            console.error("Failed to fetch scratchpads", err);
        }
    }, [user.id]);

    useEffect(() => {
        fetchScratchpads();
    }, [fetchScratchpads]);

    const createScratchpad = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        try {
            const res = await fetch(`${API_BASE_URL}/scratchpads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, title: newTitle }),
            });
            const newPad = await res.json();
            setScratchpads([...scratchpads, newPad]);
            setNewTitle('');
        } catch (err) {
            console.error("Failed to create scratchpad", err);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#F8FAFC',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                background: '#fff',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: '#2563EB', padding: 6, borderRadius: 8, color: 'white' }}>
                        <BrainCircuit size={20} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 18, color: '#0F172A', letterSpacing: '-0.5px' }}>
                        McKinsey<span style={{ color: '#2563EB' }}>Agent</span>
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 14, color: '#64748B' }}>
                        Welcome, <span style={{ fontWeight: 600, color: '#1E293B' }}>{user.username}</span>
                    </span>
                    <button
                        onClick={onLogout}
                        style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            color: '#64748B',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#FEE2E2';
                            e.currentTarget.style.borderColor = '#FCA5A5';
                            e.currentTarget.style.color = '#991B1B';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = '#E2E8F0';
                            e.currentTarget.style.color = '#64748B';
                        }}
                    >
                        <LogOut size={14} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                padding: '48px 24px',
                overflowY: 'auto',
                maxWidth: '1200px',
                width: '100%',
                margin: '0 auto'
            }}>
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: '#0F172A',
                        marginBottom: 8,
                        letterSpacing: '-0.5px'
                    }}>
                        Your Scratchpads
                    </h1>
                    <p style={{ fontSize: 16, color: '#64748B' }}>
                        Create and manage your analysis workspaces
                    </p>
                </div>

                {/* Create New Scratchpad */}
                <form onSubmit={createScratchpad} style={{ marginBottom: 32 }}>
                    <div style={{
                        display: 'flex',
                        gap: 12,
                        maxWidth: '600px'
                    }}>
                        <input
                            type="text"
                            placeholder="New scratchpad name..."
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: 8,
                                border: '1px solid #CBD5E1',
                                fontSize: 14,
                                outline: 'none',
                                background: '#fff'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                padding: '12px 24px',
                                background: '#2563EB',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 14,
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Plus size={16} />
                            Create
                        </button>
                    </div>
                </form>

                {/* Scratchpad Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 20
                }}>
                    {scratchpads.map(pad => (
                        <div
                            key={pad.id}
                            onClick={() => onSelectScratchpad(pad)}
                            style={{
                                background: '#fff',
                                border: '1px solid #E2E8F0',
                                borderRadius: 12,
                                padding: '24px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                                e.currentTarget.style.borderColor = '#BFDBFE';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                                <div style={{
                                    background: '#EFF6FF',
                                    padding: 8,
                                    borderRadius: 8,
                                    color: '#2563EB'
                                }}>
                                    <FolderOpen size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: '#1E293B',
                                        marginBottom: 4,
                                        wordBreak: 'break-word'
                                    }}>
                                        {pad.title}
                                    </h3>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12,
                                color: '#64748B'
                            }}>
                                <Calendar size={12} />
                                {new Date(pad.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {scratchpads.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '64px 24px',
                        color: '#94A3B8'
                    }}>
                        <FolderOpen size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <p style={{ fontSize: 16, fontWeight: 500 }}>No scratchpads yet</p>
                        <p style={{ fontSize: 14, marginTop: 8 }}>Create your first workspace to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
