import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import MatchCard from '../components/MatchCard';
import { Flame } from 'lucide-react';
import { ConfigContext } from '../context/ConfigContext';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const Home = ({ user, setUser }) => {
  const { config } = useContext(ConfigContext);
  const [matches, setMatches] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hotTake, setHotTake] = useState(null);
  const [iceCreamSprint, setIceCreamSprint] = useState(null);
  const [doubleJokerActive, setDoubleJokerActive] = useState(false);
  const [selectedChampion, setSelectedChampion] = useState('');

  const fetchData = async () => {
    try {
      const [matchesRes, tipsRes, iceCreamRes, doubleJokerRes] = await Promise.all([
        axios.get(`${API_URL}/matches`),
        axios.get(`${API_URL}/tips/${user.id}`),
        axios.get(`${API_URL}/ice-cream-sprint`).catch(() => ({ data: { event: null } })),
        axios.get(`${API_URL}/double-joker`).catch(() => ({ data: { event: null } }))
      ]);
      setMatches(matchesRes.data);
      setTips(tipsRes.data);
      if (iceCreamRes.data.event) {
        setIceCreamSprint(iceCreamRes.data.event);
      }
      setDoubleJokerActive(!!doubleJokerRes.data.event);
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHotTake = async () => {
    try {
      const res = await axios.get(`${API_URL}/hot-take`);
      if (res.data.hotTake) {
        setHotTake(res.data.hotTake);
      }
    } catch (err) {
      console.error("Error fetching hot take", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHotTake();
    // Refresh data every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user.id]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading matches...</div>;

  // Filter out future stages that shouldn't be tipped yet based on prior stage completion
  // For simplicity, we assume 'Group' stage is always open.
  // We'll show 'Round of 16' only if there are matches in it.
  

  
  const dynamicTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam, m.awayTeam]).filter(t => t && t !== 'TBD' && !t.includes('TBD')))).sort();
  const teams = config?.championTeams?.length > 0 ? config.championTeams : dynamicTeams;
  
  const r32Matches = matches.filter(m => m.stage === 'r32');
  let r32Started = false;
  if (r32Matches.length > 0) {
    const sortedR32 = [...r32Matches].sort((a, b) => new Date(a.kickoffTime) - new Date(b.kickoffTime));
    const deadline = new Date(new Date(sortedR32[0].kickoffTime).getTime() + 3 * 24 * 60 * 60 * 1000);
    r32Started = new Date() >= deadline;
  }

  const handleChampionSubmit = async () => {
    if (!selectedChampion) return;
    try {
      await axios.post(`${API_URL}/champion`, { userId: user.id, champion: selectedChampion });
      const updatedUser = { ...user, predictedChampion: selectedChampion };
      if (setUser) setUser(updatedUser);
      localStorage.setItem('worldCupUser', JSON.stringify(updatedUser));
    } catch (err) {
      alert('Failed to submit champion prediction: ' + (err.response?.data?.error || err.message));
    }
  };
  
  return (
    <div className="space-y-8 animate-fade-in">

      
      {/* Champion Prediction Panel */}
      <div className="glass-card bg-gradient-to-r from-amber-500/10 via-yellow-500/20 to-amber-600/10 border-yellow-500/40 relative overflow-hidden group">
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <img src="/champion_trophy.png" alt="Champion Trophy" className="w-28 h-28 object-contain drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] group-hover:scale-105 transition-transform duration-500" />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">Predict the Champion 🏆</h2>
            <p className="text-gray-300 text-sm mb-4">
              Correctly predict the ultimate winner within the first three days of the Round of 32 to earn a massive <span className="font-bold text-yellow-400">12-point bonus</span> at the end of the tournament!
            </p>
            
            {user.predictedChampion ? (
              <div className="bg-black/40 border border-yellow-500/30 rounded-lg p-3 inline-block">
                <span className="text-gray-400 text-sm mr-2">Your Pick:</span>
                <span className="text-xl font-bold text-white">{user.predictedChampion}</span>
                {r32Started ? (
                  <span className="ml-3 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/20">Locked</span>
                ) : (
                  <span className="ml-3 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/20">Active</span>
                )}
              </div>
            ) : r32Started ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 inline-block text-red-400">
                We are more than 3 days into the Round of 32. Champion predictions are now locked!
              </div>
            ) : (
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <select 
                  className="input-glass border-yellow-500/30 w-48"
                  value={selectedChampion}
                  onChange={(e) => setSelectedChampion(e.target.value)}
                >
                  <option value="">Select a team...</option>
                  {teams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button 
                  onClick={handleChampionSubmit}
                  disabled={!selectedChampion}
                  className="btn-primary bg-gradient-to-r from-yellow-500 to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Lock In Pick
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {hotTake && (
        <div className="glass-card bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="text-orange-500 w-6 h-6" />
            <h2 className="text-xl font-bold text-white">This Week's Boldest Prediction</h2>
          </div>
          <p className="text-gray-300 italic">
            "{hotTake.text}"
          </p>
          <div className="mt-2 text-sm text-gray-500 font-medium">
            — Predicted by @{hotTake.user}
          </div>
        </div>
      )}

      {/* Mid-Tournament Spice Up Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ice Cream Sprint */}
        {iceCreamSprint && iceCreamSprint.matchId && matches.find(m => m.id === iceCreamSprint.matchId)?.status !== 'completed' && (
          <div className="glass-card bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/30 flex items-center gap-4 relative overflow-hidden">
            <img src="/ice_cream.png" alt="Ice Cream Bounty" className="w-24 h-24 object-contain drop-shadow-xl animate-pulse" />
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Ice Cream Sprint! 🍦</h2>
              <p className="text-sm text-gray-300">{iceCreamSprint.announcementText}</p>
            </div>
          </div>
        )}

        {/* Double Joker Flash Event */}
        {doubleJokerActive && (
          <div className="glass-card bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border-cyan-500/30 flex items-center gap-4 relative overflow-hidden">
            <img src="/joker.png" alt="Double Joker Event" className="w-24 h-24 object-contain drop-shadow-xl" />
            <div>
              <h2 className="text-xl font-bold text-white mb-1">⚡ Double Joker Flash Event ⚡</h2>
              <p className="text-sm text-gray-300">You now have <strong className="text-cyan-400">TWO</strong> Jokers to use in this phase! Double your points on an extra match.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Upcoming Matches</h1>
          <p className="text-gray-400">Place your tips before the match locks (5 mins before kickoff).</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Points</p>
          <p className="text-3xl font-bold text-primary">
            {tips.reduce((sum, tip) => sum + (tip.points || 0), 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.filter(match => (match.homeTeam && match.awayTeam && !match.homeTeam.includes('TBD') && !match.awayTeam.includes('TBD'))).map(match => {
          const userTip = tips.find(t => t.matchId === match.id);
          const phase = match.stage.startsWith('Group') ? 'Group Stage' : 'Knockout Stage';
          
          // Check how many Jokers are used elsewhere in this phase
          const jokersUsedInPhase = tips.filter(t => {
            if (!t.jokerApplied || t.matchId === match.id) return false;
            const m = matches.find(m => m.id === t.matchId);
            return m && (m.stage.startsWith('Group') ? 'Group Stage' : 'Knockout Stage') === phase;
          }).length;
          
          const jokerAvailable = jokersUsedInPhase < (doubleJokerActive ? 2 : 1);

          return (
            <MatchCard 
              key={match.id} 
              match={match} 
              tip={userTip} 
              user={user}
              phase={phase}
              jokerAvailable={jokerAvailable}
              onTipUpdate={fetchData} 
            />
          );
        })}
      </div>
      
      {matches.length === 0 && (
        <div className="text-center py-20 glass rounded-2xl border-white/5">
          <p className="text-gray-400">No matches scheduled yet.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
