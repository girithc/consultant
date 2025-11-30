import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import API_BASE_URL from './config';

const LoginModal = ({ onClose, onLogin }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isRegistering ? `${API_BASE_URL}/auth/register` : `${API_BASE_URL}/auth/login`;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || 'Authentication failed');
            }

            onLogin(data);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                background: 'white', borderRadius: 16, padding: 32, width: 400,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: 16, right: 16,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94A3B8'
                    }}
                >
                    <X size={20} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
                        {isRegistering ? 'Sign up to save your work' : 'Log in to save your work'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: '#FEF2F2', color: '#EF4444', padding: '10px',
                        borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: 8,
                                border: '1px solid #CBD5E1', fontSize: 14, outline: 'none',
                                boxSizing: 'border-box'
                            }}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: 8,
                                border: '1px solid #CBD5E1', fontSize: 14, outline: 'none',
                                boxSizing: 'border-box'
                            }}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 8,
                            padding: '12px', borderRadius: 8, border: 'none',
                            background: '#2563EB', color: 'white', fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            fontSize: 14
                        }}
                    >
                        {loading && <Loader2 size={16} className="spin" />}
                        {isRegistering ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#64748B' }}>
                    {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                    <button
                        onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                        style={{
                            background: 'none', border: 'none', color: '#2563EB',
                            fontWeight: 600, cursor: 'pointer', padding: 0
                        }}
                    >
                        {isRegistering ? 'Log In' : 'Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
