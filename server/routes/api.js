const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcryptjs');
const { getMatches, getMatch, getUsers, createUser, getUser, submitTip, getTipsForUser, getTipsForMatch, getAllTips, updatePassword, updateUserAdmin, updateUserDepartment, wipeUserTips, wipeEntireDatabase, getOracleMessage, deleteUserAndTips, getApiKeys, setApiKeys, populateUnderdogs, getActiveEvent, updateActiveEvent, getConfig, updateConfig, createMatch, editMatch, deleteMatch } = require('../services/db');

let officeNewsCache = { text: null, lastUpdated: 0 };

router.post('/auth/register', async (req, res) => {
  try {
    const { id, name, email, department, password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });
    
    const existingUser = await getUser(id);
    if (existingUser) return res.status(400).json({ error: 'User ID already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser({ id, name, email, department, password: hashedPassword });
    res.status(201).json({ id, name, email, department, score: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { id, password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await getUser(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Don't send password hash to client
    const { password: _, ...userWithoutPassword } = user;
    userWithoutPassword.isAdmin = !!userWithoutPassword.isAdmin || userWithoutPassword.email === process.env.ADMIN_EMAIL;

    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/apikey', async (req, res) => {
  try {
    const { adminEmail, newKey, footballApiKey } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await setApiKeys(newKey, footballApiKey);
    
    // Reset caches since keys changed
    if (newKey) insightsCache.text = null;
    
    res.json({ success: true, message: 'API Keys securely saved to database!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/config', async (req, res) => {
  try {
    const { adminEmail, tournamentName, departments, championTeams, enableExternalApi } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await updateConfig({ tournamentName, departments, championTeams, enableExternalApi });
    
    res.json({ success: true, message: 'Configuration securely saved to database!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/reset-password', async (req, res) => {
  try {
    const { adminEmail, targetUserId, newPassword } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updatePassword(targetUserId, hashedPassword);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { syncLiveMatches } = require('../services/cron');

router.post('/admin/sync-live', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await syncLiveMatches();
    
    res.json({ success: true, message: 'Successfully fetched live data and updated matches!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/populate-underdogs', async (req, res) => {
  try {
    await populateUnderdogs();
    res.json({ success: true, message: 'Underdogs updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/matches', async (req, res) => {
  try {
    const { adminEmail, match } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await createMatch(match);
    res.json({ success: true, message: 'Match created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/matches/:id', async (req, res) => {
  try {
    const { adminEmail, match } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await editMatch(req.params.id, match);
    res.json({ success: true, message: 'Match updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/matches/:id', async (req, res) => {
  try {
    const { adminEmail } = req.body; // Since this is DELETE we might need adminEmail in query or body
    const email = req.body.adminEmail || req.query.adminEmail;
    const adminUser = (await getUsers()).find(u => u.email === email);
    if (email !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await deleteMatch(req.params.id);
    res.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matches', async (req, res) => {
  try {
    const matches = await getMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matches/:matchId/tips', async (req, res) => {
  try {
    const match = await getMatch(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    
    const now = new Date();
    const kickoff = new Date(match.kickoffTime);
    const lockTime = new Date(kickoff.getTime() - 1000 * 60 * 5);
    
    if (now < lockTime && match.status !== 'completed') {
      return res.status(403).json({ error: 'Tips are blinded until the match locks' });
    }
    
    const tips = await getTipsForMatch(req.params.matchId);
    // Enrich with user names
    const users = await getUsers();
    const enrichedTips = tips.map(t => {
      const u = users.find(user => user.id === t.userId);
      return { ...t, userName: u ? u.name : t.userId };
    });
    
    res.json(enrichedTips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tips/:userId', async (req, res) => {
  try {
    const tips = await getTipsForUser(req.params.userId);
    res.json(tips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/champion', async (req, res) => {
  try {
    const { userId, champion } = req.body;
    
    const { getMatches, updateUserChampion } = require('../services/db');
    const matches = await getMatches();
    const r32Matches = matches.filter(m => m.stage === 'r32');
    if (r32Matches.length > 0) {
      r32Matches.sort((a, b) => new Date(a.kickoffTime) - new Date(b.kickoffTime));
      const firstR32Kickoff = new Date(r32Matches[0].kickoffTime);
      const deadline = new Date(firstR32Kickoff.getTime() + 3 * 24 * 60 * 60 * 1000);
      if (new Date() >= deadline) {
        return res.status(403).json({ error: 'Champion prediction is locked 3 days into the Round of 32.' });
      }
    }
    
    await updateUserChampion(userId, champion);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tips', async (req, res) => {
  try {
    const { id, userId, matchId, homeScore, awayScore, jokerApplied } = req.body;
    const match = await getMatch(matchId);
    
    if (!match) return res.status(404).json({ error: 'Match not found' });
    
    const now = new Date();
    const kickoff = new Date(match.kickoffTime);
    const lockTime = new Date(kickoff.getTime() - 1000 * 60 * 5);
    
    if (now >= lockTime) {
      return res.status(403).json({ error: 'Match is locked for tipping' });
    }
    
    await submitTip({ id, userId, matchId, homeScore, awayScore, jokerApplied });
    res.status(200).json({ message: 'Tip submitted' });
    
    // Background analytics sync for "My Tip Buddy"
    const { calculateAndCacheTipBuddies } = require('../services/analytics');
    calculateAndCacheTipBuddies().catch(err => console.error('Tip Buddy sync failed:', err));
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tip-buddies', async (req, res) => {
  try {
    const { getTipBuddies } = require('../services/db');
    const buddies = await getTipBuddies();
    res.json(buddies || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await getUsers();
    
    const departments = {};
    users.forEach(u => {
      if (!departments[u.department]) departments[u.department] = { total: 0, count: 0 };
      departments[u.department].total += u.score;
      departments[u.department].count += 1;
    });
    
    const deptLeaderboard = Object.keys(departments).map(dept => ({
      department: dept,
      average: departments[dept].total / departments[dept].count
    })).sort((a, b) => b.average - a.average);
    
    const allMatches = await getMatches();
    
    // Final Match Logic
    const finalMatch = allMatches.find(m => m.id === 'm104');
    let worldCupWinner = null;
    let finalMatchCompleted = false;
    
    if (finalMatch && finalMatch.status === 'completed') {
      finalMatchCompleted = true;
      worldCupWinner = finalMatch.homeScore > finalMatch.awayScore ? finalMatch.homeTeam : finalMatch.awayTeam;
    }
    
    // Ice Cream Sprint Logic
    let iceCreamSprint = null;
    const activeIceCreamEvent = await getActiveEvent('ice_cream_sprint');
    
    if (activeIceCreamEvent && activeIceCreamEvent.matchId) {
      const iceCreamMatch = allMatches.find(m => m.id === activeIceCreamEvent.matchId);
      
      if (iceCreamMatch && iceCreamMatch.status === 'completed') {
        const completionTime = new Date(iceCreamMatch.kickoffTime).getTime() + (150 * 60 * 1000); // 150 mins after kickoff
        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        
        // If within 3 days after completion
        if (now <= completionTime + threeDaysMs) {
          const allTips = await getAllTips();
          const iceCreamTips = allTips.filter(t => t.matchId === activeIceCreamEvent.matchId);
          
          if (iceCreamTips.length > 0) {
            const maxPoints = Math.max(...iceCreamTips.map(t => t.points || 0));
            if (maxPoints > 0) {
              const winningTips = iceCreamTips.filter(t => (t.points || 0) === maxPoints);
              const winningUserNames = winningTips.map(t => {
                const u = users.find(user => user.id === t.userId);
                return u ? u.name : t.userId;
              });
              iceCreamSprint = {
                winners: winningUserNames,
                points: maxPoints
              };
            }
          }
        }
      }
    }
    
    res.json({ users, departments: deptLeaderboard, iceCreamSprint, worldCupWinner, finalMatchCompleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let insightsCache = { text: null, lastUpdated: 0 };

router.get('/insights', async (req, res) => {
  try {
    const keys = await getApiKeys();
    const apiKey = keys.gemini;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.json({ insights: "⚠️ AI Insights require a valid Gemini API Key to be configured. Please ask the Admin to set one." });
    }
    
    const now = Date.now();
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (insightsCache.text && (now - insightsCache.lastUpdated <= CACHE_EXPIRATION_MS)) {
      return res.json({ insights: insightsCache.text });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    
    // Fetch users for internal pool state
    const users = await getUsers();
    const activeUsers = users.map(u => ({ name: u.name, score: u.score, streak: u.currentStreak, department: u.department }));
    
    const departments = {};
    users.forEach(u => {
      if (!departments[u.department]) departments[u.department] = { total: 0, count: 0 };
      departments[u.department].total += u.score;
      departments[u.department].count += 1;
    });
    const deptLeaderboard = Object.keys(departments).map(dept => ({
      department: dept,
      average: Number((departments[dept].total / departments[dept].count).toFixed(2))
    })).sort((a, b) => b.average - a.average);
    
    // Fetch real football data
    let nextMatch = null;
    let realFootballData = null;
    let activeTeamsStr = '';
    try {
      const allMatches = await getMatches();
      const nowTime = new Date();
      nextMatch = allMatches
        .filter(m => new Date(m.kickoffTime) > nowTime || m.status === 'pending')
        .sort((a, b) => new Date(a.kickoffTime) - new Date(b.kickoffTime))[0];
        
      const pendingMatches = allMatches.filter(m => m.status === 'pending');
      const activeTeamsSet = new Set();
      for (const m of pendingMatches) {
        if (m.homeTeam && !m.homeTeam.includes('TBD') && !m.homeTeam.includes('Winner') && !m.homeTeam.includes('Loser') && m.homeTeam !== 'null') {
          activeTeamsSet.add(m.homeTeam);
        }
        if (m.awayTeam && !m.awayTeam.includes('TBD') && !m.awayTeam.includes('Winner') && !m.awayTeam.includes('Loser') && m.awayTeam !== 'null') {
          activeTeamsSet.add(m.awayTeam);
        }
      }
      activeTeamsStr = Array.from(activeTeamsSet).join(', ');

      if (nextMatch) {
        const fallbackText = `Based purely on football history, generate a completely biased, hilarious prediction for our office tipping pool regarding the match between ${nextMatch.homeTeam} and ${nextMatch.awayTeam}.`;
        realFootballData = fallbackText; // default fallback
        
        try {
          const rssRes = await axios.get("https://www.bigdsoccer.com/rss/");
          const xml2js = require('xml2js');
          const parser = new xml2js.Parser({ explicitArray: false });
          const result = await parser.parseStringPromise(rssRes.data);
          
          const items = result.rss?.channel?.item || [];
          const articles = Array.isArray(items) ? items : [items];
          
          let relevantContexts = [];
          for (const item of articles) {
            const title = item.title || "";
            const desc = item.description || "";
            const content = `${title} ${desc}`.toLowerCase();
            
            if (content.includes(nextMatch.homeTeam.toLowerCase()) || content.includes(nextMatch.awayTeam.toLowerCase())) {
              const cleanDesc = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              const sentences = cleanDesc.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 2);
              if (sentences.length > 0) {
                relevantContexts.push(sentences.join('. ') + '.');
              }
              if (relevantContexts.length >= 3) break;
            }
          }
          
          if (relevantContexts.length > 0) {
            realFootballData = `Latest news context for ${nextMatch.homeTeam} vs ${nextMatch.awayTeam}:\n${relevantContexts.join('\n')}`;
          }
        } catch (rssErr) {
          console.error("Failed to fetch or parse RSS feed:", rssErr.message);
        }
      } else {
        realFootballData = "No upcoming matches found.";
      }
    } catch (dbErr) {
      console.error("Failed to fetch matches for insights:", dbErr.message);
      realFootballData = "No live data available.";
    }

    const combinedPrompt = `Act as an expert sports analyst and a hilarious office banter expert for our 2026 World Cup tipping pool.
Here is the current state of our internal tipping pool players: ${JSON.stringify(activeUsers)}.
Here is the department leaderboard ranked by AVERAGE score: ${JSON.stringify(deptLeaderboard)}.
Here is the real World Cup football data from our API: ${realFootballData}.
Active Teams Still In The Tournament: ${activeTeamsStr || 'Unknown'}

Write a highly engaging, short report formatted in Markdown with these EXACT three sections:

### 🏆 Office Pool Banter
Write a fun, VERY short recap (1-2 sentences maximum) highlighting who is on a roll individually, and specifically mention the current top department rankings based strictly on their AVERAGE rating. Gently roast those struggling. Keep it light and brief!

### ⚽ Real World Cup Action
Provide a VERY short comment (1-2 sentences maximum) on the real recent results. Additionally, add a beautiful formatted prediction for the SPECIFIC upcoming match mentioned in the football data below. Do not invent a matchup. You MUST include a percentage prediction on the next match outcome (e.g., "USA 3 - 0 Bosnia (75% confidence)").

### 📊 Real World Cup Projected Standings
Render a beautiful Markdown table called 'Real World Cup Projected Standings' predicting how the top 5 actual World Cup teams (countries) will rank at the end of the tournament. Base this on your general knowledge of the 2026 tournament favorites and the news provided. Include a column with sarcastic commentary about each team's chances. 
CRITICAL: Ensure the table and your commentary ONLY include teams that are STILL IN THE WORLD CUP CONTEST! Refer strictly to the "Active Teams Still In The Tournament" list provided above. Do not include teams that have already been eliminated.

Ensure the output is high-class, beautiful Markdown and keep the overall text extremely concise.`;

    const result = await model.generateContent(combinedPrompt);
    const combinedText = result.response.text();
    
    insightsCache.text = combinedText;
    insightsCache.lastUpdated = now;
    
    res.json({ insights: combinedText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to fetch insights', details: error.message });
  }
});

router.get('/hot-take', async (req, res) => {
  try {
    const keys = await getApiKeys();
    const apiKey = keys.gemini;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.json({ hotTake: null });
    }
    
    const tips = await getAllTips();
    if (tips.length === 0) return res.json({ hotTake: null });
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `Here are the current user predictions for our office World Cup tipping pool: ${JSON.stringify(tips)}. Find the most outlandish, bold, or funny prediction (e.g. an unlikely blowout score). Write a short, funny 2-sentence "hot take" commentary for it. Keep it lighthearted. Format your response exactly as JSON: {"user": "User ID here", "text": "Your 2 sentence hot take"}`;
    
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);
    
    res.json({ hotTake: parsed });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to fetch hot take' });
  }
});

router.get('/leaderboard/trajectory', async (req, res) => {
  try {
    const users = await getUsers();
    const topUsers = users.slice(0, 5); 
    const matches = await getMatches();
    const tips = await getAllTips();
    
    const completedMatches = matches.filter(m => m.status === 'completed').sort((a, b) => new Date(a.kickoffTime) - new Date(b.kickoffTime));
    
    const data = [];
    let currentScores = {};
    topUsers.forEach(u => currentScores[u.name] = 0);
    
    data.push({ name: 'Start', ...currentScores });

    completedMatches.forEach((match, index) => {
      topUsers.forEach(u => {
        const tip = tips.find(t => t.matchId === match.id && t.userId === u.id);
        if (tip) {
          currentScores[u.name] += tip.points || 0;
        }
      });
      data.push({
        name: `M${index + 1}`,
        ...currentScores
      });
    });
    
    res.json({ topUsers: topUsers.map(u => u.name), data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/digest', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });

    const keys = await getApiKeys();
    const apiKey = keys.gemini;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.json({ digest: "⚠️ A valid Gemini API Key is required to generate the digest. Please configure one in the Admin panel." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const users = await getUsers();
    const matches = await getMatches();
    const tips = await getAllTips();

    const completedMatches = matches.filter(m => m.status === 'completed').sort((a, b) => new Date(b.kickoffTime) - new Date(a.kickoffTime));
    
    let recentMatches = [];
    if (completedMatches.length > 0) {
      const latestDateStr = new Date(completedMatches[0].kickoffTime).toDateString();
      recentMatches = completedMatches.filter(m => new Date(m.kickoffTime).toDateString() === latestDateStr);
    }

    const pointsGained = {};
    users.forEach(u => pointsGained[u.name] = 0);
    
    recentMatches.forEach(match => {
      users.forEach(u => {
        const tip = tips.find(t => t.matchId === match.id && t.userId === u.id);
        if (tip) {
          pointsGained[u.name] += tip.points || 0;
        }
      });
    });

    let maxGained = -1;
    let topGainers = [];
    let roughDayPersons = [];

    users.forEach(u => {
      if (pointsGained[u.name] > maxGained) {
        maxGained = pointsGained[u.name];
        topGainers = [u.name];
      } else if (pointsGained[u.name] === maxGained && maxGained > 0) {
        topGainers.push(u.name);
      }
      
      const hasRecentTips = tips.some(t => t.userId === u.id && recentMatches.some(rm => rm.id === t.matchId));
      if (hasRecentTips && pointsGained[u.name] === 0) {
        roughDayPersons.push(u.name);
      }
    });

    let minScore = Infinity;
    let spoonHolders = [];
    users.forEach(u => {
      if (u.score < minScore) {
        minScore = u.score;
        spoonHolders = [u.name];
      } else if (u.score === minScore) {
        spoonHolders.push(u.name);
      }
    });

    const uniqueScores = [...new Set(users.map(u => u.score))].sort((a, b) => b - a);
    const top3Tiers = uniqueScores.slice(0, 3);
    
    const medals = ['🥇', '🥈', '🥉'];
    let digest = `⚽ *OFFICE WORLD CUP DIGEST* ⚽\n`;
    
    if (completedMatches.length > 0) {
        const latestMatch = completedMatches[0];
        digest += `📊 *Latest Result:* ${latestMatch.homeTeam} ${latestMatch.homeScore} - ${latestMatch.awayScore} ${latestMatch.awayTeam}\n\n`;
    } else {
        digest += `\n`;
    }
    
    digest += `🏆 *CURRENT TOP 3:*\n`;
    top3Tiers.forEach((score, index) => {
        const playersWithScore = users.filter(u => u.score === score).map(u => u.name).join(', ');
        digest += `${index + 1}. ${playersWithScore} - ${score} pts ${medals[index] || ''}\n`;
    });
    
    digest += `\n🚀 *YESTERDAY'S HIGHLIGHTS:*\n`;
    if (topGainers.length > 0 && maxGained > 0) {
      digest += `- 🔥 *Top Gainer:* ${topGainers.join(', ')} with +${maxGained} points!\n`;
    } else {
      digest += `- 🔥 *Top Gainer:* No points scored yesterday!\n`;
    }
    
    if (roughDayPersons.length > 0) {
      digest += `- 🥶 *Rough Day:* ${roughDayPersons.join(', ')} missed out on yesterday's points.\n`;
    } else {
      digest += `- 🥶 *Rough Day:* Everyone who played scored points!\n`;
    }

    if (spoonHolders.length > 0) {
      const spoonMsg = spoonHolders.length === 1 
        ? `${spoonHolders[0]} is currently sitting at the bottom of the table`
        : `${spoonHolders.join(', ')} are currently sitting at the bottom of the table`;
      digest += `- 🪵 *Wooden Spoon Holder:* ${spoonMsg}! Keep pushing!\n`;
    } else {
      digest += `- 🪵 *Wooden Spoon Holder:* Nobody is eligible for the spoon yet!\n`;
    }

    digest += `\n✨ *SPECIAL EVENTS CURRENTLY ACTIVE:* ✨\n`;
    digest += `- ⚡ *DOUBLE JOKER FLASH EVENT:* You currently have an extra Joker to spend this phase! Don't forget to use it to double your points on an extra match!\n`;
    digest += `- 🍦 *ICE CREAM SPRINT:* The top scorer of the upcoming Germany match gets a giant ice cream sponsored by Tobias! Choose wisely!\n`;

    res.json({ digest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/toggle-admin', async (req, res) => {
  try {
    const { adminEmail, targetUserId, isAdmin } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await updateUserAdmin(targetUserId, isAdmin);
    res.json({ success: true, message: 'Admin status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/change-team', async (req, res) => {
  try {
    const { adminEmail, targetUserId, department } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await updateUserDepartment(targetUserId, department);
    res.json({ success: true, message: 'User team updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/force-tip', async (req, res) => {
  try {
    const { adminEmail, userId, matchId, homeScore, awayScore, jokerApplied } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Create a unique tip ID like the frontend does (e.g., tip_userId_matchId)
    const tipId = `tip_${userId}_${matchId}`;
    
    await submitTip({ 
      id: tipId, 
      userId, 
      matchId, 
      homeScore, 
      awayScore, 
      jokerApplied: jokerApplied || false 
    });
    
    res.json({ success: true, message: 'Tip forcefully submitted by admin' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



router.post('/admin/refresh-insights', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    insightsCache.lastUpdated = 0;
    insightsCache.text = null;
    
    const { clearTipBuddiesCache } = require('../services/db');
    await clearTipBuddiesCache();
    
    const { calculateAndCacheTipBuddies } = require('../services/analytics');
    calculateAndCacheTipBuddies().catch(err => console.error('Tip Buddy refresh failed:', err));

    res.json({ success: true, message: 'AI Insights cache cleared! The next visit to the Insights page will generate fresh content.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/wipe-tips', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await wipeUserTips();
    res.json({ success: true, message: 'User tips and scores have been wiped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/wipe-database', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await wipeEntireDatabase();
    res.json({ success: true, message: 'Entire database (tips + matches) has been wiped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/delete-user', async (req, res) => {
  try {
    const { adminEmail, targetUserId } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) return res.status(403).json({ error: 'Unauthorized' });
    
    await deleteUserAndTips(targetUserId);
    res.json({ success: true, message: 'User and all associated tips deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/oracle', async (req, res) => {
  try {
    const oracle = await getOracleMessage();
    res.json({ oracle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ice-cream-sprint', async (req, res) => {
  try {
    const event = await getActiveEvent('ice_cream_sprint');
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/ice-cream-sprint', async (req, res) => {
  try {
    const { adminEmail, matchId, announcementText } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) {
       return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await updateActiveEvent('ice_cream_sprint', matchId, announcementText);
    res.json({ success: true, message: 'Ice Cream Sprint launched successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/double-joker', async (req, res) => {
  try {
    const event = await getActiveEvent('double_joker');
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/double-joker', async (req, res) => {
  try {
    const { adminEmail, isActive } = req.body;
    const adminUser = (await getUsers()).find(u => u.email === adminEmail);
    if (adminEmail !== process.env.ADMIN_EMAIL && (!adminUser || !adminUser.isAdmin)) {
       return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const db = require('../services/db');
    if (isActive) {
      await db.updateActiveEvent('double_joker', 'all', 'Double Joker Active');
    } else {
      await db.clearActiveEvent('double_joker');
    }
    res.json({ success: true, message: `Double Joker event ${isActive ? 'enabled' : 'disabled'}!` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
