import React, { useState } from 'react';
import { BrainCircuit, LogIn, UserPlus } from 'lucide-react';
import './App.css';

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegistering ? '/auth/register' : '/auth/login';

    try {
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Authentication failed');
      }

      const user = await response.json();
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#fff',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: '1px solid #E2E8F0',
        width: '100%',
        maxWidth: '420px'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ background: '#2563EB', padding: 8, borderRadius: 10, color: 'white' }}>
            <BrainCircuit size={28} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 24, color: '#0F172A', letterSpacing: '-0.5px' }}>
            McKinsey<span style={{ color: '#2563EB' }}>Agent</span>
          </span>
        </div>

        <h2 style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#1E293B',
          marginBottom: 8,
          textAlign: 'center'
        }}>
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </h2>

        <p style={{
          fontSize: 14,
          color: '#64748B',
          marginBottom: 32,
          textAlign: 'center'
        }}>
          {isRegistering ? 'Sign up to start analyzing' : 'Sign in to continue'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 14,
                outline: 'none',
                background: '#F8FAFC',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 14,
                outline: 'none',
                background: '#F8FAFC',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              color: '#991B1B',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              padding: '12px 20px',
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
              marginTop: 8
            }}
          >
            {isRegistering ? <UserPlus size={16} /> : <LogIn size={16} />}
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 14,
          color: '#64748B'
        }}>
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            onClick={() => setIsRegistering(!isRegistering)}
            style={{
              color: '#2563EB',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none'
            }}
          >
            {isRegistering ? 'Sign In' : 'Sign Up'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Login;
