import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Workspace from './Workspace';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [currentScratchpad, setCurrentScratchpad] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('agent_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('agent_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentScratchpad(null);
    localStorage.removeItem('agent_user');
  };

  const handleSelectScratchpad = (pad) => {
    setCurrentScratchpad(pad);
  };

  const handleBackToDashboard = () => {
    setCurrentScratchpad(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentScratchpad) {
    return <Workspace scratchpad={currentScratchpad} onBack={handleBackToDashboard} />;
  }

  return <Dashboard user={user} onSelectScratchpad={handleSelectScratchpad} onLogout={handleLogout} />;
}

export default App;