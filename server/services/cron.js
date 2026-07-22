const cron = require('node-cron');
const axios = require('axios');
const { getMatches, updateMatch, getAllTips, updateTipPoints, updateUserScore, getUsers, updateUserStreak, updateMatchTeams, setOracleMessage, clearOracleMessage, getOracleMessage, getApiKeys } = require('./db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const calculatePoints = (tip, match, userCurrentStreak) => {
  let basePoints = 0;
  let correctOutcome = false;
  
  const tipOutcome = tip.homeScore > tip.awayScore ? 'home' : (tip.homeScore < tip.awayScore ? 'away' : 'draw');
  const matchOutcome = match.homeScore > match.awayScore ? 'home' : (match.homeScore < match.awayScore ? 'away' : 'draw');

  if (tip.homeScore === match.homeScore && tip.awayScore === match.awayScore) {
    basePoints = 3;
    correctOutcome = true;
  } else if (tipOutcome === matchOutcome) {
    // Check exact goal difference
    if ((tip.homeScore - tip.awayScore) === (match.homeScore - match.awayScore)) {
      basePoints = 2;
    } else {
      basePoints = 1;
    }
    correctOutcome = true;
  }

  // Underdog Bonus (+2 points)
  if (correctOutcome && match.underdog) {
    const winningTeam = matchOutcome === 'home' ? match.homeTeam : (matchOutcome === 'away' ? match.awayTeam : null);
    if (winningTeam && winningTeam === match.underdog) {
      basePoints += 2;
    }
  }

  // Streak Bonus (+1 point)
  if (correctOutcome && userCurrentStreak >= 3) {
    basePoints += 1;
  }
  
  // Joker Multiplier (x2)
  let finalMatchPoints = basePoints;
  if (tip.jokerApplied) {
    finalMatchPoints *= 2;
  }
  
  return { points: finalMatchPoints, correctOutcome };
};

const getGroupWinner = (matches, groupName) => {
  const groupMatches = matches.filter(m => m.stage === groupName && m.status === 'completed');
  if (groupMatches.length < 4) return null; // Wait for all matches to complete (2 per team, roughly 4 total matches per group in our mock)

  const points = {};
  groupMatches.forEach(m => {
    if (!points[m.homeTeam]) points[m.homeTeam] = 0;
    if (!points[m.awayTeam]) points[m.awayTeam] = 0;

    if (m.homeScore > m.awayScore) points[m.homeTeam] += 3;
    else if (m.homeScore < m.awayScore) points[m.awayTeam] += 3;
    else {
      points[m.homeTeam] += 1;
      points[m.awayTeam] += 1;
    }
  });

  const sortedTeams = Object.keys(points).sort((a, b) => points[b] - points[a]);
  return { first: sortedTeams[0], second: sortedTeams[1] };
};

const syncLiveMatches = async () => {
  const { getConfig } = require('./db');
  const config = await getConfig();
  if (!config.enableExternalApi) {
    console.log('External API sync is disabled in configuration. Skipping...');
    return;
  }

  console.log('Fetching live games to sync scores...');
  try {
    const response = await axios.get('https://worldcup26.ir/get/games');
    const liveGames = response.data.games;
    
    const matches = await getMatches();
    const now = new Date();
    
    let hasUpdates = false;

    for (const match of matches) {
      if (match.status === 'completed') continue; // Skip matches we've already officially closed

      // Get the corresponding live game (e.g. 'm1' -> '1')
      const gameId = match.id.replace('m', '');
      const liveGame = liveGames.find(g => g.id === gameId);

      if (!liveGame) continue;

      const isLiveFinished = liveGame.finished === 'TRUE';
      const liveHomeScore = parseInt(liveGame.home_score) || 0;
      const liveAwayScore = parseInt(liveGame.away_score) || 0;

      // Update teams if they were populated
      const liveHomeTeam = liveGame.home_team_name_en || null;
      const liveAwayTeam = liveGame.away_team_name_en || null;
      
      if (liveHomeTeam && liveAwayTeam && (match.homeTeam !== liveHomeTeam || match.awayTeam !== liveAwayTeam)) {
        // Prevent overwriting a manual override with placeholder names from the API
        if (
          match.homeTeam && !match.homeTeam.includes('Loser') && !match.homeTeam.includes('Winner') && 
          (liveHomeTeam.includes('Loser') || liveHomeTeam.includes('Winner') || liveHomeTeam.includes('TBD'))
        ) {
          console.log(`Skipping team sync for ${match.id} to prevent overwriting manual override with placeholder API data.`);
        } else {
          await updateMatchTeams(match.id, liveHomeTeam, liveAwayTeam, match.underdog);
          match.homeTeam = liveHomeTeam;
          match.awayTeam = liveAwayTeam;
          console.log(`Match ${match.id} teams populated from API: ${liveHomeTeam} vs ${liveAwayTeam}`);
        }
      }

      // Update if scores changed OR if it just finished
      if (match.homeScore !== liveHomeScore || match.awayScore !== liveAwayScore || isLiveFinished) {
        
        await updateMatch(match.id, liveHomeScore, liveAwayScore, isLiveFinished ? 'completed' : 'pending');
        match.homeScore = liveHomeScore;
        match.awayScore = liveAwayScore;
        match.status = isLiveFinished ? 'completed' : 'pending';
        hasUpdates = true;

        console.log(`Match ${match.id} updated. ${match.homeTeam} ${liveHomeScore} - ${liveAwayScore} ${match.awayTeam} (Finished: ${isLiveFinished})`);

        // Only calculate points and do oracle shoutouts if the match OFFICIALLY finished
        if (isLiveFinished) {
          const tips = await getAllTips();
          const matchTips = tips.filter(t => t.matchId === match.id);
          const usersForStreaks = await getUsers();
          
          for (const tip of matchTips) {
            const user = usersForStreaks.find(u => u.id === tip.userId);
            const currentStreak = user ? user.currentStreak : 0;
            
            const { points, correctOutcome } = calculatePoints(tip, match, currentStreak);
            await updateTipPoints(tip.id, points);
            
            if (correctOutcome) {
              await updateUserStreak(tip.userId, currentStreak + 1);
            } else {
              await updateUserStreak(tip.userId, 0);
            }
          }

          // Oracle Evaluation
          const totalTips = matchTips.length;
          const outcomeCounts = { home: 0, away: 0, draw: 0 };
          matchTips.forEach(t => {
            const out = t.homeScore > t.awayScore ? 'home' : (t.homeScore < t.awayScore ? 'away' : 'draw');
            outcomeCounts[out]++;
          });
          const matchActualOutcome = match.homeScore > match.awayScore ? 'home' : (match.homeScore < match.awayScore ? 'away' : 'draw');
          const percentGuessedOutcome = totalTips > 0 ? (outcomeCounts[matchActualOutcome] / totalTips) * 100 : 100;

          const keys = await getApiKeys();
          const apiKey = keys.gemini;
          if (percentGuessedOutcome > 0 && percentGuessedOutcome < 15 && apiKey) {
            const rareGuessers = matchTips.filter(t => {
              const out = t.homeScore > t.awayScore ? 'home' : (t.homeScore < t.awayScore ? 'away' : 'draw');
              return out === matchActualOutcome;
            }).map(t => {
              const user = usersForStreaks.find(u => u.id === t.userId);
              return { name: user.name, department: user.department, tip: `${t.homeScore}-${t.awayScore}` };
            });

            if (rareGuessers.length > 0) {
              try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ 
                  model: "gemini-3.1-flash-lite",
                  generationConfig: { responseMimeType: "application/json" }
                });
                const prompt = `You are a funny football commentator for an office tipping pool called 'The Office Oracle'. 
                The match ${match.homeTeam} vs ${match.awayTeam} just ended with a final score of ${match.homeScore}-${match.awayScore}. 
                Less than 15% of the office predicted this! The geniuses who got it right are: ${JSON.stringify(rareGuessers)}.
                Write a funny, supportive 1-2 sentence shoutout praising their bold football intelligence. Mention all their names!`;
                const result = await model.generateContent(prompt);
                const message = result.response.text().trim();
                
                const nextMatches = matches.filter(m => m.status === 'pending' && m.id !== match.id);
                const expiresAt = nextMatches.length > 0 ? nextMatches[0].kickoffTime : null;
                await setOracleMessage(message, match.id, expiresAt);
              } catch (aiErr) {
                console.error('Oracle Gemini generation failed:', aiErr.message);
              }
            }
          }
        }
      }
    }
    
    // Check if current Oracle is expired
    const currentOracle = await getOracleMessage();
    if (currentOracle && currentOracle.expiresAt) {
      if (new Date(currentOracle.expiresAt) <= now) {
        await clearOracleMessage();
        console.log('Oracle message expired and cleared.');
      }
    }
    
    if (hasUpdates) {
      // Recalculate user scores
      const users = await getUsers();
      const allTips = await getAllTips();
      
      for (const user of users) {
        const userTips = allTips.filter(t => t.userId === user.id);
        let totalScore = userTips.reduce((acc, tip) => acc + tip.points, 0);
        
        // Add 12 bonus points if they predicted the champion correctly
        const finalMatch = matches.find(m => m.stage === 'final' && m.status === 'completed');
        if (finalMatch && user.predictedChampion) {
          let actualChampion = null;
          if (finalMatch.homeScore > finalMatch.awayScore) {
            actualChampion = finalMatch.homeTeam;
          } else if (finalMatch.awayScore > finalMatch.homeScore) {
            actualChampion = finalMatch.awayTeam;
          }
          if (user.predictedChampion === actualChampion) {
            totalScore += 12;
          }
        }
        
        await updateUserScore(user.id, totalScore);
      }
      
      // Check bracket progression
      const groupA = getGroupWinner(matches, 'Group A');
      const groupB = getGroupWinner(matches, 'Group B');
      const groupC = getGroupWinner(matches, 'Group C');

      if (groupA && groupB) {
        const r32_1 = matches.find(m => m.id === 'r32_1');
        if (r32_1 && r32_1.homeTeam.includes('TBD')) {
          await updateMatchTeams('r32_1', groupA.first, groupB.second, groupB.second);
          console.log(`Round of 32 Match 1 populated: ${groupA.first} vs ${groupB.second} (Underdog: ${groupB.second})`);
        }
        
        const r32_2 = matches.find(m => m.id === 'r32_2');
        if (r32_2 && r32_2.homeTeam.includes('TBD')) {
          await updateMatchTeams('r32_2', groupB.first, groupA.second, groupA.second);
          console.log(`Round of 32 Match 2 populated: ${groupB.first} vs ${groupA.second} (Underdog: ${groupA.second})`);
        }
      }
      
      if (groupC && groupA && groupB) {
        const r32_3 = matches.find(m => m.id === 'r32_3');
        if (r32_3 && r32_3.homeTeam.includes('TBD')) {
          const thirdPlace = Math.random() > 0.5 ? groupA.second : groupB.first; // Mock logic for 3rd place 
          await updateMatchTeams('r32_3', groupC.first, thirdPlace, thirdPlace);
          console.log(`Round of 32 Match 3 populated: ${groupC.first} vs ${thirdPlace} (Underdog: ${thirdPlace})`);
        }
      }
      
      console.log('Scores and brackets updated.');
    }
  } catch (error) {
    console.error('Error in live sync cron job:', error);
  }
};

const initCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const matches = await getMatches();
      const now = new Date();
      
      let shouldSync = false;

      for (const m of matches) {
        if (m.status === 'completed') continue;
        const kickoff = new Date(m.kickoffTime);
        const minPassed = Math.floor((now - kickoff) / (1000 * 60));
        
        // Sync every 25 minutes during and after the match (until it is marked completed by syncLiveMatches)
        // 150 mins is exactly 2.5 hours, which is also a multiple of 25.
        if (minPassed >= 0 && minPassed % 25 < 5) {
          shouldSync = true;
          break;
        }
      }

      if (shouldSync) {
        syncLiveMatches();
      }
    } catch (err) {
      console.error("Cron check failed:", err);
    }
  });

  // Keep a daily fallback sync just to be safe
  cron.schedule('0 0 * * *', syncLiveMatches);
  console.log('Cron job initialized to poll live data on the specific schedule requested.');
};

module.exports = { initCron, syncLiveMatches };
