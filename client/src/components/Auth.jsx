import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { Trophy, LogIn, UserPlus } from 'lucide-react';
import { ConfigContext } from '../context/ConfigContext';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const Auth = ({ onLogin }) => {
  const { config } = useContext(ConfigContext);
  const [isLogin, setIsLogin] = useState(true);
  
  // Set default department from config if available
  const initialDept = config?.departments?.length > 0 ? config.departments[0] : 'Control-Alt-Defeat (Real CTC)';
  const [formData, setFormData] = useState({ id: '', name: '', email: '', department: initialDept, password: '' });
  
  useEffect(() => {
    if (config?.departments?.length > 0 && formData.department === 'Control-Alt-Defeat (Real CTC)') {
      setFormData(prev => ({ ...prev, department: config.departments[0] }));
    }
  }, [config]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/auth/login`, { id: formData.id, password: formData.password });
        onLogin(res.data);
      } else {
        if (!formData.id || !formData.name || !formData.email || !formData.password) {
          throw new Error('Please fill in all fields');
        }
        const res = await axios.post(`${API_URL}/auth/register`, formData);
        onLogin(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <Trophy className="w-16 h-16 text-primary mb-4" />
        <h1 className="text-3xl font-bold text-center text-balance">{config?.tournamentName || 'World Cup Tipping'}</h1>
        <p className="text-gray-400 mt-2">Predict the future. Win the glory.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">{error}</div>}
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Username (ID)</label>
          <input
            type="text"
            className="input-glass w-full"
            placeholder="e.g., tobias"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
          <input
            type="password"
            className="input-glass w-full"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
        </div>

        {!isLogin && (
          <>
            <div className="animate-slide-up">
              <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
              <input
                type="text"
                className="input-glass w-full"
                placeholder="Tobias"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="animate-slide-up">
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                className="input-glass w-full"
                placeholder="tobias@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="animate-slide-up">
              <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
              <select
                className="input-glass w-full bg-surface"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                {config?.departments?.length > 0 ? config.departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                )) : (
                  <>
                    <option value="Control-Alt-Defeat (Real CTC)">Control-Alt-Defeat (Real CTC)</option>
                    <option value="The Smooth Operators (Atlético RTC)">The Smooth Operators (Atlético RTC)</option>
                    <option value="The Desk-Side Defenders (Inter Local FC)">The Desk-Side Defenders (Inter Local FC)</option>
                  </>
                )}
              </select>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex justify-center items-center gap-2 mt-6"
        >
          {loading ? 'Processing...' : (isLogin ? <><LogIn size={20}/> Login</> : <><UserPlus size={20}/> Register</>)}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
