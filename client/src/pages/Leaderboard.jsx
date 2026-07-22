import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, Medal, Award, Users } from 'lucide-react';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import HallOfFame from '../components/HallOfFame';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const Leaderboard = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [oracleMsg, setOracleMsg] = useState(null);
  const [iceCreamSprint, setIceCreamSprint] = useState(null);
  const [worldCupWinner, setWorldCupWinner] = useState(null);
  const [finalMatchCompleted, setFinalMatchCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const [res, trajRes, oracleRes] = await Promise.all([
          axios.get(`${API_URL}/leaderboard`),
          axios.get(`${API_URL}/leaderboard/trajectory`).catch(() => ({ data: null })),
          axios.get(`${API_URL}/oracle`).catch(() => ({ data: null }))
        ]);
        setUsers(res.data.users);
        setDepartments(res.data.departments);
        setIceCreamSprint(res.data.iceCreamSprint);
        setWorldCupWinner(res.data.worldCupWinner);
        setFinalMatchCompleted(res.data.finalMatchCompleted);
        if (trajRes.data) setTrajectoryData(trajRes.data);
        if (oracleRes.data?.oracle) {
          setOracleMsg(oracleRes.data.oracle.message);
        } else {
          setOracleMsg(null);
        }
      } catch (err) {
        console.error("Error fetching leaderboard", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const uniqueScores = [...new Set(users.map(u => u.score))].sort((a, b) => b - a);
  const minScore = users.length > 0 ? Math.min(...users.map(u => u.score)) : Infinity;

  const getRankIcon = (score) => {
    const rankIndex = uniqueScores.indexOf(score);
    if (rankIndex === 0) return '🥇';
    if (rankIndex === 1) return '🥈';
    if (rankIndex === 2) return '🥉';
    return <span className="text-gray-500 font-bold w-6 text-center">{rankIndex + 1}</span>;
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Loading leaderboard...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Global Leaderboard</h1>
          <p className="text-gray-400">See how you stack up against the competition.</p>
        </div>
      </div>

      {finalMatchCompleted && (
        <HallOfFame users={users} departments={departments} worldCupWinner={worldCupWinner} />
      )}

      {iceCreamSprint && (
        <div className="glass-card border-pink-500/30 bg-pink-900/10 shadow-[0_0_15px_rgba(236,72,153,0.15)] animate-fade-in flex items-center gap-4">
          <span className="text-4xl animate-bounce">🍦</span>
          <div>
            <h2 className="text-xl font-bold text-pink-400">Ice Cream Sprint Winner!</h2>
            <p className="text-gray-300">
              Congratulations to <strong className="text-white">{iceCreamSprint.winners.join(', ')}</strong> for scoring <strong className="text-white">{iceCreamSprint.points} points</strong> on the latest sprint match! See the Admin to claim your prize!
            </p>
          </div>
        </div>
      )}

      {oracleMsg && (
        <div className="glass-card border-purple-500/30 bg-purple-900/10 shadow-[0_0_15px_rgba(168,85,247,0.15)] animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl animate-pulse">🔮</span>
            <h2 className="text-xl font-bold text-purple-400">The Office Oracle</h2>
          </div>
          <p className="text-gray-300 italic text-lg leading-relaxed">"{oracleMsg}"</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass rounded-2xl overflow-hidden border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/20 border-b border-white/5">
                    <th className="py-4 px-6 font-semibold text-gray-400 w-16">Rank</th>
                    <th className="py-4 px-6 font-semibold text-gray-400">Player</th>
                    <th className="py-4 px-6 font-semibold text-gray-400">Department</th>
                    <th className="py-4 px-6 font-semibold text-gray-400 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr 
                      key={u.id} 
                      className={clsx(
                        "border-b border-white/5 transition-colors hover:bg-white/5",
                        u.id === user.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
                      )}
                    >
                      <td className="py-4 px-6 text-2xl text-center">
                        {getRankIcon(u.score)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-white flex items-center gap-2">
                          {u.name}
                          {u.currentStreak >= 3 && <span title={`${u.currentStreak} in a row!`} className="text-xl">🔥</span>}
                          {u.score === minScore && <span title="Wooden Spoon Holder" className="text-xl">🥄</span>}
                        </div>
                        <div className="text-xs text-gray-500">@{u.id}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-300">
                        {u.department}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-primary text-xl">
                        {u.score}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-gray-500">No players yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {trajectoryData && trajectoryData.data.length > 0 && (
            <div className="glass rounded-2xl p-6 border-white/5">
              <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                📈 Top 5 Performance Trajectory
              </h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Legend />
                    {trajectoryData.topUsers.map((userName, idx) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      return (
                        <Line key={userName} type="monotone" dataKey={userName} stroke={colors[idx % colors.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-6">
              <Users className="text-secondary" />
              <h2 className="text-xl font-bold">Department Clash</h2>
            </div>
            
            <div className="space-y-4">
              {departments.map((dept, index) => (
                <div key={dept.department} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 font-bold w-4">{index + 1}</span>
                    <span className="font-medium">{dept.department}</span>
                  </div>
                  <div className="text-secondary font-bold">
                    {dept.average.toFixed(1)} <span className="text-xs font-normal text-gray-500">avg</span>
                  </div>
                </div>
              ))}
              {departments.length === 0 && (
                <div className="text-center text-gray-500 text-sm">No department stats.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
