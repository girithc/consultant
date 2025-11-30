import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Workspace from './Workspace';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [currentScratchpad, setCurrentScratchpad] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('agent_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsGuest(false);
    localStorage.setItem('agent_user', JSON.stringify(userData));
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setCurrentScratchpad({ id: null, title: "New Scratchpad" });
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
    setCurrentScratchpad(null);
    localStorage.removeItem('agent_user');
  };

  const handleSelectScratchpad = (pad) => {
    setCurrentScratchpad(pad);
  };

  const handleBackToDashboard = () => {
    setCurrentScratchpad(null);
    if (isGuest) {
      setIsGuest(false);
    }
  };

  if (!user && !isGuest) {
    return <Login onLogin={handleLogin} onGuest={handleGuestLogin} />;
  }

  if (currentScratchpad) {
    return (
      <Workspace
        scratchpad={currentScratchpad}
        user={user}
        onBack={handleBackToDashboard}
        onLogin={handleLogin}
      />
    );
  }

  return <Dashboard user={user} onSelectScratchpad={handleSelectScratchpad} onLogout={handleLogout} />;
}

export default App;