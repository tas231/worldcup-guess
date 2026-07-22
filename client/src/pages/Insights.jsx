import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const Insights = ({ user }) => {
  const [insights, setInsights] = useState('');
  const [buddies, setBuddies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [insightsRes, buddiesRes] = await Promise.all([
        axios.get(`${API_URL}/insights`),
        axios.get(`${API_URL}/tip-buddies`)
      ]);
      setInsights(insightsRes.data.insights);
      if (buddiesRes.data && Object.keys(buddiesRes.data).length > 0) {
        setBuddies(buddiesRes.data);
      }
    } catch (err) {
      console.error("Error fetching insights data", err);
      setError("The AI analyst is currently unavailable or API key is invalid.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="text-secondary" /> AI Insights & Social
          </h1>
          <p className="text-gray-400">Powered by Gemini. Get the latest match commentary and see who shares your betting brain.</p>
        </div>
      </div>

      {buddies && (
        <div className="space-y-4">
          <div className="mt-8 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🧬 My Tip Buddy
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Tracking prediction alignment across the office. Who shares your football DNA, and who is your tactical polar opposite?
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {buddies.soulmates && (
              <div className="glass-card bg-gradient-to-br from-pink-500/10 to-red-500/10 border-pink-500/20">
                <div className="text-center mb-3">
                  <span className="text-4xl">💍</span>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-1">The Soulmates</h3>
                <div className="flex justify-center mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                    Highest Sync Pair
                  </span>
                </div>
                <p className="text-center text-sm mb-3 text-gray-300">
                  <span className="font-medium text-pink-300">{buddies.soulmates.users.map(u => u.name).join(' & ')}</span>
                  <br />
                  <span className="text-pink-400 font-bold">({buddies.soulmates.sync}% Sync)</span>
                </p>
                <p className="text-gray-400 text-sm italic">
                  "{buddies.soulmates.commentary}"
                </p>
              </div>
            )}
            
            {buddies.hiveMind && (
              <div className="glass-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                <div className="text-center mb-3">
                  <span className="text-4xl">🧠</span>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-1">The Hive Mind</h3>
                <div className="flex justify-center mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Largest Matching Cluster
                  </span>
                </div>
                <p className="text-center text-sm mb-3 text-gray-300">
                  <span className="font-medium text-blue-300">{buddies.hiveMind.users.map(u => u.name).join(', ')}</span>
                  <br />
                  <span className="text-blue-400 font-bold">({buddies.hiveMind.sync}% Sync)</span>
                </p>
                <p className="text-gray-400 text-sm italic">
                  "{buddies.hiveMind.commentary}"
                </p>
              </div>
            )}
            
            {buddies.archNemeses && (
              <div className="glass-card bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20">
                <div className="text-center mb-3">
                  <span className="text-4xl">🤺</span>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-1">The Arch Nemeses</h3>
                <div className="flex justify-center mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Maximum Disagreement
                  </span>
                </div>
                <p className="text-center text-sm mb-3 text-gray-300">
                  <span className="font-medium text-orange-300">{buddies.archNemeses.users.map(u => u.name).join(' & ')}</span>
                  <br />
                  <span className="text-orange-400 font-bold">({buddies.archNemeses.sync}% Sync)</span>
                </p>
                <p className="text-gray-400 text-sm italic">
                  "{buddies.archNemeses.commentary}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-card relative overflow-hidden min-h-[300px] mt-8">
        {/* Background decorative element */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 text-white/5">
          <Bot size={200} />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
            <Sparkles className="animate-spin text-primary w-8 h-8" />
            <p>Gemini is analyzing the tournament...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400 space-y-2">
            <p>{error}</p>
          </div>
        ) : (
          <div className="relative z-10 prose prose-invert prose-p:text-gray-300 prose-headings:text-white max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="w-full text-left border-collapse" {...props} /></div>,
                th: ({node, ...props}) => <th className="bg-white/10 px-4 py-2 font-semibold text-white border-b border-white/20" {...props} />,
                td: ({node, ...props}) => <td className="px-4 py-2 border-b border-white/10 text-gray-300" {...props} />
              }}
            >
              {insights}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default Insights;
