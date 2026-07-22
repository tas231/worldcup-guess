import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Save, Star, Eye } from 'lucide-react';
import clsx from 'clsx';
import { differenceInMinutes } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3001/api';

const MatchCard = ({ match, tip, user, phase, jokerAvailable, onTipUpdate }) => {
  const [homeScore, setHomeScore] = useState(tip?.homeScore ?? '');
  const [awayScore, setAwayScore] = useState(tip?.awayScore ?? '');
  const [jokerApplied, setJokerApplied] = useState(tip?.jokerApplied ?? false);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [formattedDate, setFormattedDate] = useState('');
  const [otherTips, setOtherTips] = useState([]);
  const [showOtherTips, setShowOtherTips] = useState(false);

  useEffect(() => {
    // Format to German Time (CEST)
    const kickoff = new Date(match.kickoffTime);
    const formatter = new Intl.DateTimeFormat('de-DE', { 
      timeZone: 'Europe/Berlin', 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    });
    setFormattedDate(formatter.format(kickoff) + ' CEST');

    const checkLock = () => {
      const now = new Date();
      const diffMins = differenceInMinutes(kickoff, now);
      
      if (diffMins <= 5) {
        setIsLocked(true);
        setTimeRemaining('Locked');
      } else {
        setIsLocked(false);
        setTimeRemaining(`Locks in ${diffMins}m`);
      }
    };

    checkLock();
    const interval = setInterval(checkLock, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [match.kickoffTime]);

  const handleSave = async () => {
    if (homeScore === '' || awayScore === '') return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/tips`, {
        id: tip ? tip.id : `${user.id}_${match.id}`,
        userId: user.id,
        matchId: match.id,
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
        jokerApplied
      });
      onTipUpdate();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save tip');
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherTips = async () => {
    try {
      const res = await axios.get(`${API_URL}/matches/${match.id}/tips`);
      setOtherTips(res.data.filter(t => t.userId !== user.id));
      setShowOtherTips(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot fetch tips yet');
    }
  };

  const hasResult = match.status === 'completed';

  return (
    <div className={clsx("glass-card relative overflow-hidden", isLocked && !hasResult && "opacity-80 border-red-500/30", match.stage === 'final' && "final-match-card", match.stage === 'third' && "third-match-card")}>
      {hasResult && (
        <div className="absolute top-0 right-0 bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-bl-lg font-semibold">
          Final
        </div>
      )}
      {!hasResult && isLocked && (
        <div className="absolute top-0 right-0 bg-red-500/20 text-red-400 text-xs px-3 py-1 rounded-bl-lg font-semibold flex items-center gap-1">
          <Lock size={12} /> Locked
        </div>
      )}

      <div className="flex justify-between items-center mb-4 text-sm text-gray-400">
        <div className="flex items-center gap-3">
          <span className="bg-white/5 px-2 py-1 rounded">{match.stage}</span>
          <span className="text-gray-300 font-medium">{formattedDate}</span>
        </div>
        {!hasResult && !isLocked && <span>{timeRemaining}</span>}
      </div>

      <div className="flex items-center justify-between mb-6 h-20">
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          {match.underdog === match.homeTeam && (
            <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 mb-1.5 rounded border border-primary/30 uppercase tracking-widest whitespace-nowrap shrink-0">Underdog Bonus</span>
          )}
          <span className="font-bold text-sm sm:text-base leading-tight text-center break-words max-w-full px-1">
            {match.homeTeam || (match.stage === 'final' ? 'Finalist 1' : match.stage === 'third' ? '3rd Place Contender 1' : 'TBD')}
          </span>
        </div>
        
        <div className="flex items-center gap-2 px-2 shrink-0">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="input-glass w-12 sm:w-14 text-center text-xl font-bold bg-white/5 p-1"
            value={homeScore}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^[0-9\b]+$/.test(val)) setHomeScore(val);
            }}
          />
          <span className="text-gray-500 font-bold shrink-0">-</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="input-glass w-12 sm:w-14 text-center text-xl font-bold bg-white/5 p-1"
            value={awayScore}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^[0-9\b]+$/.test(val)) setAwayScore(val);
            }}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          {match.underdog === match.awayTeam && (
            <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 mb-1.5 rounded border border-primary/30 uppercase tracking-widest whitespace-nowrap shrink-0">Underdog Bonus</span>
          )}
          <span className="font-bold text-sm sm:text-base leading-tight text-center break-words max-w-full px-1">
            {match.awayTeam || (match.stage === 'final' ? 'Finalist 2' : match.stage === 'third' ? '3rd Place Contender 2' : 'TBD')}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-4">
        <button
          onClick={() => setJokerApplied(!jokerApplied)}
          disabled={isLocked || hasResult || (!jokerAvailable && !jokerApplied)}
          className={clsx(
            "flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border-2 shadow-lg transition-all duration-300 font-bold uppercase tracking-wider text-[10px] sm:text-xs",
            jokerApplied 
              ? "bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 border-yellow-200 text-black shadow-yellow-500/50 scale-105" 
              : "bg-gradient-to-br from-purple-700 to-indigo-900 border-purple-500/50 text-purple-200 hover:border-purple-400 hover:text-white hover:shadow-purple-500/30",
            (isLocked || hasResult || (!jokerAvailable && !jokerApplied)) && "cursor-not-allowed opacity-50 grayscale scale-100"
          )}
          title={!jokerAvailable && !jokerApplied ? `Joker already used for ${phase}` : "Use Phase Joker (x2 points)"}
        >
          <span className="text-sm sm:text-base drop-shadow-md">{jokerApplied ? '⭐' : '🃏'}</span>
          {!jokerAvailable && !jokerApplied ? "Joker Used" : "Use Joker"}
        </button>

        {!hasResult && !isLocked && (
          <button
            onClick={handleSave}
            disabled={loading || homeScore === '' || awayScore === ''}
            className="btn-primary py-1 px-4 text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} /> Save Tip
          </button>
        )}
        
        {hasResult && (
          <div className="text-sm">
            <span className="text-gray-400">Result: </span>
            <span className="font-bold">{match.homeScore} - {match.awayScore}</span>
            {tip && (
              <span className="ml-4 px-2 py-1 bg-primary/20 text-primary rounded-full text-xs font-bold">
                +{tip.points || 0} pts
              </span>
            )}
          </div>
        )}
      </div>

      {(isLocked || hasResult) && !showOtherTips && (
        <div className="mt-4 pt-4 border-t border-white/5 text-center">
          <button 
            onClick={fetchOtherTips}
            className="text-sm text-primary hover:text-white transition-colors flex items-center gap-1 mx-auto"
          >
            <Eye size={16} /> View All Tips
          </button>
        </div>
      )}

      {showOtherTips && (
        <div className="mt-4 pt-4 border-t border-white/5 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Other Players' Tips</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
            {otherTips.length === 0 ? (
              <p className="text-xs text-gray-500">No other tips for this match.</p>
            ) : (
              otherTips.map(t => (
                <div key={t.id} className="flex justify-between items-center text-sm bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="font-medium text-gray-300">{t.userName} {t.jokerApplied && <span title="Joker Applied">🌟</span>}</span>
                  <span className="font-bold text-white">{t.homeScore} - {t.awayScore}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchCard;
