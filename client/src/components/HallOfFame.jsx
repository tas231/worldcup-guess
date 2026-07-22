import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Trophy, Medal, Award, Crown, Star } from 'lucide-react';

import { ConfigContext } from '../context/ConfigContext';

const Confetti = () => {
  const [pieces, setPieces] = useState([]);
  
  useEffect(() => {
    // Generate 150 confetti pieces for a wilder effect
    const newPieces = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * -20}%`,
      animationDelay: `${Math.random() * 2}s`,
      animationDuration: `${Math.random() * 3 + 4}s`,
      color: ['bg-yellow-400', 'bg-yellow-300', 'bg-yellow-600', 'bg-amber-500', 'bg-white'][Math.floor(Math.random() * 5)]
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl z-0">
      {pieces.map((p) => (
        <div
          key={p.id}
          className={clsx(
            'absolute w-2 h-6 animate-confetti rounded-full opacity-80',
            p.color
          )}
          style={{
            left: p.left,
            top: p.top,
            animationDelay: p.animationDelay,
            animationDuration: p.animationDuration
          }}
        />
      ))}
    </div>
  );
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const PodiumStep = ({ user, rank, heightClass, colorClass, borderClass, shadowClass, label, delayClass }) => {
  if (!user) return null;
  
  const isFirst = rank === 1;
  const initials = getInitials(user.name);
  
  return (
    <div className={clsx("flex flex-col items-center relative z-10 transition-transform hover:scale-105 duration-300", delayClass, "animate-fade-in-up")}>
      <div className="mb-4 relative">
        <div className={clsx("w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 relative z-20", borderClass, "bg-surface", shadowClass)}>
          <span className="text-white">{initials}</span>
          {isFirst && (
            <Crown className="absolute -top-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-bounce" size={32} />
          )}
        </div>
      </div>
      
      <div className="text-center mb-2">
        <div className="font-bold text-lg text-white truncate max-w-[120px]">{user.name}</div>
        <div className={clsx("font-extrabold text-2xl", colorClass)}>{user.score} <span className="text-sm font-normal text-gray-400">pts</span></div>
      </div>
      
      <div className={clsx(
        "w-28 sm:w-36 rounded-t-lg border-t border-l border-r border-white/20 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md flex flex-col items-center justify-start pt-4 relative overflow-hidden",
        heightClass
      )}>
        <div className={clsx("absolute top-0 w-full h-1", colorClass.replace('text-', 'bg-'))}></div>
        <span className={clsx("text-4xl font-black drop-shadow-md", colorClass)}>{rank}</span>
        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</span>
      </div>
    </div>
  );
};

const HallOfFame = ({ users, departments, worldCupWinner }) => {
  const { config } = React.useContext(ConfigContext);
  if (!users || users.length === 0) return null;
  
  const topUsers = [...users].sort((a, b) => b.score - a.score).slice(0, 3);
  const first = topUsers[0];
  const second = topUsers[1];
  const third = topUsers[2];
  
  const topDepartment = departments && departments.length > 0 ? [...departments].sort((a, b) => b.average - a.average)[0] : null;
  
  // Find users who predicted the winner correctly
  const championGuessers = users.filter(u => u.predictedChampion && u.predictedChampion === worldCupWinner);

  return (
    <div className="w-full relative mb-12">
      <div className="text-center mb-8 animate-fade-in">
        <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-700 tracking-tight drop-shadow-sm uppercase">
          Hall of Fame
        </h2>
        <p className="text-gray-400 mt-2 text-lg">The {config?.tournamentName || 'tournament'} has concluded. Behold your tipping champions!</p>
      </div>

      <div className="glass-card relative border-yellow-500/30 overflow-hidden px-4 py-12 sm:px-12 bg-black/40">
        <Confetti />
        
        {/* Podium Area */}
        <div className="flex justify-center items-end gap-2 sm:gap-6 pt-10 relative z-10">
          <PodiumStep 
            user={second} 
            rank={2} 
            label="Silver"
            heightClass="h-32 sm:h-40" 
            colorClass="text-gray-300"
            borderClass="border-gray-400"
            shadowClass="shadow-[0_0_20px_rgba(156,163,175,0.4)]"
            delayClass="animation-delay-200"
          />
          <PodiumStep 
            user={first} 
            rank={1} 
            label="Gold"
            heightClass="h-44 sm:h-56" 
            colorClass="text-yellow-400"
            borderClass="border-yellow-400"
            shadowClass="shadow-[0_0_30px_rgba(250,204,21,0.6)]"
            delayClass="animation-delay-500"
          />
          <PodiumStep 
            user={third} 
            rank={3} 
            label="Bronze"
            heightClass="h-24 sm:h-32" 
            colorClass="text-amber-600"
            borderClass="border-amber-700"
            shadowClass="shadow-[0_0_15px_rgba(180,83,9,0.4)]"
            delayClass="animation-delay-800"
          />
        </div>
      </div>

      {/* Top Department Banner */}
      {topDepartment && (
        <div className="mt-6 glass rounded-xl p-1 relative z-10 overflow-hidden animate-fade-in-up animation-delay-1000 border border-yellow-500/20">
          {/* Shine animation overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[200%] animate-[gold-shine_3s_infinite_linear]"></div>
          
          <div className="bg-surface/80 backdrop-blur-sm rounded-lg p-6 flex flex-col md:flex-row items-center justify-between z-10 relative">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
                <Trophy className="text-black" size={28} />
              </div>
              <div>
                <div className="text-yellow-500 font-bold text-sm tracking-widest uppercase mb-1 flex items-center gap-2">
                  <Star size={14} /> Top Team Department <Star size={14} />
                </div>
                <h3 className="text-2xl font-black text-white">{topDepartment.department}</h3>
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Average Score</div>
              <div className="text-3xl font-black text-yellow-400">{topDepartment.average.toFixed(1)} <span className="text-lg text-gray-500">pts/player</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Champion Prediction Bonus */}
      {worldCupWinner && (
        <div className="mt-6 glass-card relative z-10 border-green-500/20 bg-green-900/10 animate-fade-in-up animation-delay-1200">
          <div className="flex items-center gap-2 mb-3">
            <Award className="text-green-400" size={24} />
            <h3 className="text-xl font-bold text-green-400">Champion Oracles</h3>
          </div>
          {championGuessers.length > 0 ? (
            <>
              <p className="text-gray-300 mb-4">
                The following players earned <strong className="text-white">+12 bonus points</strong> for correctly predicting <strong className="text-white">{worldCupWinner}</strong> to win the {config?.tournamentName || 'tournament'} from the very beginning:
              </p>
              <div className="flex flex-wrap gap-2">
                {championGuessers.map(guesser => (
                  <div key={guesser.id} className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-semibold border border-green-500/30 flex items-center gap-2">
                    {guesser.name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-300">
              The {config?.tournamentName || 'tournament'} was won by <strong className="text-white">{worldCupWinner}</strong>. Remarkably, <strong className="text-yellow-400">nobody</strong> managed to predict this from the beginning! The +12 bonus points remain unclaimed.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default HallOfFame;
