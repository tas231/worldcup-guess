import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Trash2, Edit2, Plus, Save, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const MatchManager = ({ user }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [currentMatch, setCurrentMatch] = useState({
    id: '',
    homeTeam: '',
    awayTeam: '',
    kickoffTime: '',
    stage: 'Group Stage',
    homeScore: '',
    awayScore: '',
    status: 'pending'
  });

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/matches`);
      setMatches(res.data);
    } catch (err) {
      setError('Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentMatch(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      // Validate format of kickoffTime
      const formattedMatch = {
        ...currentMatch,
        adminEmail: user.email,
        homeScore: currentMatch.homeScore === '' ? null : Number(currentMatch.homeScore),
        awayScore: currentMatch.awayScore === '' ? null : Number(currentMatch.awayScore)
      };

      if (isEditing) {
        await axios.put(`${API_URL}/admin/matches/${currentMatch.id}`, formattedMatch);
        setMessage('Match updated successfully');
      } else {
        await axios.post(`${API_URL}/admin/matches`, formattedMatch);
        setMessage('Match created successfully');
      }
      
      setIsEditing(false);
      setCurrentMatch({
        id: '', homeTeam: '', awayTeam: '', kickoffTime: '', stage: 'Group Stage', homeScore: '', awayScore: '', status: 'pending'
      });
      fetchMatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save match');
    }
  };

  const handleEdit = (match) => {
    setIsEditing(true);
    // Format date for datetime-local input
    const dateObj = new Date(match.kickoffTime);
    const tzOffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
    
    setCurrentMatch({
      ...match,
      kickoffTime: localISOTime,
      homeScore: match.homeScore ?? '',
      awayScore: match.awayScore ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this match? All related tips will be orphaned.')) return;
    try {
      await axios.delete(`${API_URL}/admin/matches/${id}`, { data: { adminEmail: user.email } });
      setMessage('Match deleted successfully');
      fetchMatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete match');
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setCurrentMatch({
      id: '', homeTeam: '', awayTeam: '', kickoffTime: '', stage: 'Group Stage', homeScore: '', awayScore: '', status: 'pending'
    });
  };

  return (
    <div className="space-y-6">
      {message && <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-4 rounded-lg">{message}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg">{error}</div>}

      <div className="glass-card border-purple-500/30">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold">{isEditing ? 'Edit Match' : 'Add New Match'}</h2>
        </div>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Match ID</label>
              <input
                type="text"
                name="id"
                required
                disabled={isEditing}
                className="input-glass w-full disabled:opacity-50"
                placeholder="e.g. m1, final, sf1"
                value={currentMatch.id}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Stage</label>
              <input
                type="text"
                name="stage"
                required
                className="input-glass w-full"
                placeholder="e.g. Group A, Round of 16, Final"
                value={currentMatch.stage}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Home Team</label>
              <input
                type="text"
                name="homeTeam"
                required
                className="input-glass w-full"
                value={currentMatch.homeTeam}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Away Team</label>
              <input
                type="text"
                name="awayTeam"
                required
                className="input-glass w-full"
                value={currentMatch.awayTeam}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Kickoff Time</label>
              <input
                type="datetime-local"
                name="kickoffTime"
                required
                className="input-glass w-full"
                value={currentMatch.kickoffTime}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                name="status"
                className="input-glass w-full bg-surface"
                value={currentMatch.status}
                onChange={handleInputChange}
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            {currentMatch.status === 'completed' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Home Score</label>
                  <input
                    type="number"
                    name="homeScore"
                    min="0"
                    className="input-glass w-full"
                    value={currentMatch.homeScore}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Away Score</label>
                  <input
                    type="number"
                    name="awayScore"
                    min="0"
                    className="input-glass w-full"
                    value={currentMatch.awayScore}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1 py-3 flex justify-center items-center gap-2">
              <Save size={18} /> {isEditing ? 'Update Match' : 'Add Match'}
            </button>
            {isEditing && (
              <button type="button" onClick={cancelEdit} className="btn-secondary px-6 flex justify-center items-center gap-2 border border-gray-600">
                <X size={18} /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="glass-card overflow-hidden">
        <h2 className="text-xl font-bold mb-4">Existing Matches</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-sm">
                <th className="pb-3 pr-4 font-medium">ID / Stage</th>
                <th className="pb-3 pr-4 font-medium">Matchup</th>
                <th className="pb-3 pr-4 font-medium">Time / Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {matches.map(m => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 align-top">
                    <div className="text-sm font-bold text-white">{m.id}</div>
                    <div className="text-xs text-gray-400">{m.stage}</div>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <div className="text-sm text-white">
                      {m.homeTeam} <span className="text-gray-500 mx-1">vs</span> {m.awayTeam}
                    </div>
                    {m.status === 'completed' && (
                      <div className="text-xs font-bold text-yellow-400 mt-1">
                        {m.homeScore} - {m.awayScore}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <div className="text-sm text-gray-300">
                      {new Date(m.kickoffTime).toLocaleString()}
                    </div>
                    <div className={`text-xs mt-1 font-semibold ${m.status === 'completed' ? 'text-green-400' : 'text-blue-400'}`}>
                      {m.status.toUpperCase()}
                    </div>
                  </td>
                  <td className="py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(m)} className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-md transition-colors" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 rounded-md transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {matches.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-gray-500">No matches found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MatchManager;
