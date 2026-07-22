import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ShieldAlert, Key, UserCog, Copy, Newspaper, AlertOctagon, Users, Trash2, Sparkles, Settings } from 'lucide-react';
import { ConfigContext } from '../context/ConfigContext';
import MatchManager from '../components/MatchManager';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const Admin = ({ user }) => {
  const { config, refetchConfig } = useContext(ConfigContext);
  
  // Config States
  const [tournamentName, setTournamentName] = useState('');
  const [departments, setDepartments] = useState('');
  const [championTeams, setChampionTeams] = useState('');
  const [enableExternalApi, setEnableExternalApi] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [footballKey, setFootballKey] = useState('');
  const [users, setUsers] = useState([]);
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changeTeamUserId, setChangeTeamUserId] = useState('');
  const [newTeam, setNewTeam] = useState('Control-Alt-Defeat (Real CTC)');
  const [matches, setMatches] = useState([]);
  const [iceCreamMatchId, setIceCreamMatchId] = useState('');
  const [iceCreamText, setIceCreamText] = useState('Tobias is sponsoring a giant ice cream for the winner of this match! Tip carefully!');
  const [doubleJokerActive, setDoubleJokerActive] = useState(false);
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (config) {
      setTournamentName(config.tournamentName || '');
      setDepartments(config.departments?.join('\n') || '');
      setChampionTeams(config.championTeams?.join('\n') || '');
      setEnableExternalApi(config.enableExternalApi ?? true);
    }
  }, [config]);

  useEffect(() => {
    // We can re-use leaderboard endpoint to get user list
    const fetchUsers = async () => {
      try {
        const [usersRes, matchesRes, doubleJokerRes] = await Promise.all([
          axios.get(`${API_URL}/leaderboard`),
          axios.get(`${API_URL}/matches`),
          axios.get(`${API_URL}/double-joker`)
        ]);
        setUsers(usersRes.data.users);
        setMatches(matchesRes.data.filter(m => m.status !== 'completed'));
        setDoubleJokerActive(!!doubleJokerRes.data.event);
      } catch (err) {
        console.error("Failed to load data for admin");
      }
    };
    if (user.isAdmin) {
      fetchUsers();
    }
  }, [user]);

  if (!user.isAdmin) {
    return (
      <div className="text-center mt-20">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-gray-400 mt-2">You must be the administrator to view this page.</p>
      </div>
    );
  }

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const deptsArray = departments.split('\n').map(d => d.trim()).filter(Boolean);
      const teamsArray = championTeams.split('\n').map(t => t.trim()).filter(Boolean);
      
      const res = await axios.put(`${API_URL}/admin/config`, {
        adminEmail: user.email,
        tournamentName,
        departments: deptsArray,
        championTeams: teamsArray,
        enableExternalApi
      });
      setMessage(res.data.message);
      refetchConfig();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update configuration');
    }
  };

  const handleUpdateApiKey = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/apikey`, {
        adminEmail: user.email,
        newKey: apiKey,
        footballApiKey: footballKey
      });
      setMessage(res.data.message);
      setApiKey('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update API key');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!resetUserId || !newPassword) return;

    try {
      const res = await axios.post(`${API_URL}/admin/reset-password`, {
        adminEmail: user.email,
        targetUserId: resetUserId,
        newPassword
      });
      setMessage(res.data.message);
      setResetUserId('');
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleChangeTeam = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!changeTeamUserId || !newTeam) return;

    try {
      const res = await axios.post(`${API_URL}/admin/change-team`, {
        adminEmail: user.email,
        targetUserId: changeTeamUserId,
        department: newTeam
      });
      setMessage(res.data.message);
      setChangeTeamUserId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change team');
    }
  };

  const copyDigest = async () => {
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/digest`, { adminEmail: user.email });
      await navigator.clipboard.writeText(res.data.digest);
      setMessage('Digest copied to clipboard successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to copy digest');
    }
  };

  const handleToggleAdmin = async (targetUserId, currentStatus) => {
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/toggle-admin`, {
        adminEmail: user.email,
        targetUserId,
        isAdmin: !currentStatus
      });
      setMessage(res.data.message);
      setUsers(users.map(u => u.id === targetUserId ? { ...u, isAdmin: !currentStatus ? 1 : 0 } : u));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle admin');
    }
  };

  const handleDeleteUser = async (targetUserId, userName) => {
    if (!window.confirm(`Are you absolutely sure you want to delete the user "${userName}" and all of their tips? This cannot be undone.`)) return;
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/delete-user`, {
        adminEmail: user.email,
        targetUserId
      });
      setMessage(res.data.message);
      setUsers(users.filter(u => u.id !== targetUserId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleWipeTips = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all user tips and reset the database? This cannot be undone.")) return;
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/wipe-tips`, { adminEmail: user.email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to wipe tips');
    }
  };

  const handleWipeDatabase = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all user tips and reset the database? This cannot be undone.")) return;
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/wipe-database`, { adminEmail: user.email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to wipe database');
    }
  };

  const handleSyncLive = async () => {
    setMessage('');
    setError('');
    try {
      setMessage('Syncing live data from worldcup26.ir...');
      const res = await axios.post(`${API_URL}/admin/sync-live`, { adminEmail: user.email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sync live data');
    }
  };

  const handleRefreshInsights = async () => {
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/refresh-insights`, { adminEmail: user.email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to refresh AI insights cache');
    }
  };

  const handleLaunchIceCream = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!iceCreamMatchId || !iceCreamText) return;

    try {
      const res = await axios.post(`${API_URL}/admin/ice-cream-sprint`, {
        adminEmail: user.email,
        matchId: iceCreamMatchId,
        announcementText: iceCreamText
      });
      setMessage(res.data.message);
      setIceCreamMatchId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to launch Ice Cream Sprint');
    }
  };

  const handleToggleDoubleJoker = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const newState = !doubleJokerActive;
      const res = await axios.post(`${API_URL}/admin/double-joker`, {
        adminEmail: user.email,
        isActive: newState
      });
      setMessage(res.data.message);
      setDoubleJokerActive(newState);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle Double Joker event');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {message && <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-4 rounded-lg">{message}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg">{error}</div>}

      {/* Global Configuration Panel */}
      <div className="glass-card border-primary/30">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Global Configuration</h2>
        </div>
        <form onSubmit={handleUpdateConfig} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tournament Name</label>
            <input
              type="text"
              className="input-glass w-full"
              value={tournamentName}
              onChange={e => setTournamentName(e.target.value)}
              placeholder="e.g. World Cup Guess, European Cup"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Departments (one per line)</label>
            <textarea
              className="input-glass w-full h-24"
              value={departments}
              onChange={e => setDepartments(e.target.value)}
              placeholder="Control-Alt-Defeat (Real CTC)&#10;The Smooth Operators (Atlético RTC)"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Champion Teams (one per line, leave empty for dynamic)</label>
            <textarea
              className="input-glass w-full h-24"
              value={championTeams}
              onChange={e => setChampionTeams(e.target.value)}
              placeholder="Germany&#10;Brazil&#10;France"
            />
          </div>
          <div className="flex items-center gap-3 bg-surface p-3 rounded-lg border border-white/10">
            <input
              type="checkbox"
              id="enableExternalApi"
              className="w-5 h-5 accent-primary"
              checked={enableExternalApi}
              onChange={e => setEnableExternalApi(e.target.checked)}
            />
            <label htmlFor="enableExternalApi" className="text-gray-300 font-medium cursor-pointer">
              Enable External API Sync (worldcup26.ir)
            </label>
          </div>
          <button type="submit" className="btn-primary w-full py-3 mt-4">Save Configuration</button>
        </form>
      </div>

      <div className="glass-card border-pink-500/30">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🍦</span>
          <h2 className="text-xl font-bold text-pink-400">Launch Ice Cream Sprint</h2>
        </div>
        <form onSubmit={handleLaunchIceCream} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select Match</label>
            <select
              className="input-glass w-full bg-surface"
              value={iceCreamMatchId}
              onChange={e => setIceCreamMatchId(e.target.value)}
            >
              <option value="">-- Choose Match --</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam} (ID: {m.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Announcement Text</label>
            <input
              type="text"
              className="input-glass w-full"
              value={iceCreamText}
              onChange={e => setIceCreamText(e.target.value)}
              placeholder="Enter the banner text to display to all users..."
            />
          </div>
          <button type="submit" className="w-full py-3 rounded-lg font-bold transition-all duration-300 bg-pink-600 hover:bg-pink-500 text-white" disabled={!iceCreamMatchId || !iceCreamText}>
            Launch Ice Cream Event!
          </button>
        </form>
      </div>

      <div className="glass-card border-cyan-500/30">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⚡</span>
          <h2 className="text-xl font-bold text-cyan-400">Double Joker Flash Event</h2>
        </div>
        <p className="text-gray-400 mb-4 text-sm">
          When active, this event allows users to place a second Joker in the current tournament phase and displays a special banner on the dashboard.
        </p>
        <button 
          onClick={handleToggleDoubleJoker} 
          className={`w-full py-3 rounded-lg font-bold transition-all duration-300 ${doubleJokerActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
        >
          {doubleJokerActive ? 'Deactivate Double Joker Event' : 'Activate Double Joker Event'}
        </button>
      </div>

      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Gemini API Configuration</h2>
        </div>
        <form onSubmit={handleUpdateApiKey} className="flex gap-4">
          <input
            type="text"
            placeholder="AIxxxx..."
            className="input-glass flex-1"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={!apiKey}>
            Set Key (Runtime)
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">Note: This sets the key in memory for the current backend process. It will reset if the server restarts.</p>
      </div>



      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <UserCog className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">User Management</h2>
        </div>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select User</label>
            <select
              className="input-glass w-full bg-surface"
              value={resetUserId}
              onChange={e => setResetUserId(e.target.value)}
            >
              <option value="">-- Choose User --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">New Password</label>
            <input
              type="password"
              className="input-glass w-full"
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={!resetUserId || !newPassword}>
            Reset Password
          </button>
        </form>

        <hr className="my-6 border-white/10" />

        <form onSubmit={handleChangeTeam} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select User</label>
            <select
              className="input-glass w-full bg-surface"
              value={changeTeamUserId}
              onChange={e => setChangeTeamUserId(e.target.value)}
            >
              <option value="">-- Choose User --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">New Team</label>
            <select
              className="input-glass w-full bg-surface"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
            >
              <option value="Control-Alt-Defeat (Real CTC)">Control-Alt-Defeat (Real CTC)</option>
              <option value="The Smooth Operators (Atlético RTC)">The Smooth Operators (Atlético RTC)</option>
              <option value="The Desk-Side Defenders (Inter Local FC)">The Desk-Side Defenders (Inter Local FC)</option>
              <option value="Goal Diggers (Sales)">Goal Diggers (Sales)</option>
              <option value="Net Assets (Finance)">Net Assets (Finance)</option>
              <option value="The Innovators (R&D)">The Innovators (R&D)</option>
              <option value="Free Agents (Other)">Free Agents (Other)</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={!changeTeamUserId || !newTeam}>
            Change Team
          </button>
        </form>
      </div>

      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Slack/Teams Digest Generator</h2>
        </div>
        <p className="text-gray-400 mb-4 text-sm">
          Generate a beautifully formatted plain-text Matchday Digest summarizing yesterday's World Cup action and the latest tipping pool standings. Click the button to instantly copy it to your clipboard.
        </p>
        <button 
          onClick={copyDigest}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
        >
          <Copy size={20} /> Generate & Copy Matchday Digest
        </button>
      </div>

      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Refresh AI Insights</h2>
        </div>
        <p className="text-gray-400 mb-4 text-sm">
          Clear the cached Gemini AI insights. The next time the Insights page is visited, the AI will generate a fresh digest immediately.
        </p>
        <button 
          onClick={handleRefreshInsights}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          <Sparkles size={20} /> Force Insights Refresh
        </button>
      </div>

      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h2 className="text-xl font-bold">Force Live Data Sync</h2>
        </div>
        <p className="text-gray-400 mb-4 text-sm">
          Manually trigger a fetch from worldcup26.ir to sync live match scores immediately instead of waiting for the 6-hour cron.
        </p>
        <button 
          onClick={handleSyncLive}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Now
        </button>
      </div>

      <MatchManager user={user} />

      <div className="glass-card">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Manage Admins</h2>
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {users.map(u => (
            <div key={u.id} className="flex justify-between items-center bg-black/20 px-4 py-2 rounded-lg border border-white/5">
              <div>
                <div className="font-bold">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              {!u.isAdmin ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                    className={`px-3 py-1 text-xs rounded font-bold ${u.isAdmin ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                  >
                    {u.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    className="p-1.5 bg-red-900/40 text-red-400 rounded hover:bg-red-900/80 transition-colors"
                    title="Delete User"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Super Admin</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card border-red-500/30">
        <div className="flex items-center gap-2 mb-4 text-red-500">
          <AlertOctagon className="w-6 h-6" />
          <h2 className="text-xl font-bold">System Reset & Clear Database</h2>
        </div>
        <p className="text-gray-400 mb-6 text-sm">
          Warning: These actions are destructive and cannot be undone. You can either wipe just the user predictions, or fully reset the entire database including the match statuses.
        </p>
        <div className="flex flex-col gap-4">
          <button 
            onClick={handleWipeTips}
            className="w-full py-3 flex items-center justify-center gap-2 bg-red-900/40 text-red-200 border border-red-500/30 rounded-lg hover:bg-red-900/60 font-bold transition-colors"
          >
            Wipe User Tips & Scores
          </button>
          <button 
            onClick={handleWipeDatabase}
            className="w-full py-3 flex items-center justify-center gap-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors shadow-lg shadow-red-500/20"
          >
            💥 Wipe & Reset Entire Database
          </button>
        </div>
      </div>
    </div>
  );
};

export default Admin;
