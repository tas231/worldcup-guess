import React from 'react';
import { Shield, Clock, Target, Star, TrendingUp } from 'lucide-react';

const Rules = () => {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Tournament Rules</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Match Lockout */}
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-bold text-white">Match Lockout</h2>
          </div>
          <p className="text-gray-400">
            All tips freeze automatically <strong className="text-white">5 minutes before kickoff</strong>. Once a match is locked, you can no longer change your prediction or toggle your Joker for that match.
          </p>
        </div>

        {/* Base Points */}
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-bold text-white">Base Points</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2">
            <li><strong className="text-white">Exact Score:</strong> 3 points (e.g., you predicted 2-1 and it ended 2-1).</li>
            <li><strong className="text-white">Goal Difference:</strong> 2 points (e.g., you predicted 2-0 and it ended 3-1).</li>
            <li><strong className="text-white">Correct Outcome:</strong> 1 point (e.g., you predicted 1-0 and it ended 3-0).</li>
            <li><strong className="text-white">Miss:</strong> 0 points.</li>
          </ul>
        </div>

        {/* Phase Joker */}
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-6 h-6 text-yellow-400" fill="currentColor" />
            <h2 className="text-xl font-bold text-white">Phase Joker (x2)</h2>
          </div>
          <p className="text-gray-400 mb-2">
            Every player receives <strong className="text-white">1 Joker per tournament stage</strong> (e.g. 1 for Group Stage, 1 for Knockouts). 
          </p>
          <p className="text-gray-400">
            Activating the Joker on a match <strong className="text-white">doubles all points</strong> earned on that specific match. Choose wisely!
          </p>
        </div>

        {/* Underdog Bonus */}
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-white">Underdog Bonus (+2)</h2>
          </div>
          <p className="text-gray-400">
            Select matches will have a designated <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs font-bold border border-primary/30 uppercase">Underdog</span>.
          </p>
          <p className="text-gray-400 mt-2">
            If you predict the underdog to win, and they actually pull off the upset, you are awarded an extra <strong className="text-white">+2 bonus points</strong> on top of your standard score!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Rules;
