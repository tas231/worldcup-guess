const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getUsers, getAllTips, getTipBuddies, setTipBuddies, getApiKeys, getMatches } = require('./db');

const getOutcome = (home, away) => {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
};

const calculateSync = (tipsA, tipsB) => {
  let score = 0;
  let maxScore = 0;
  
  tipsA.forEach(tipA => {
    const tipB = tipsB.find(t => t.matchId === tipA.matchId);
    if (tipB) {
      maxScore += 3;
      
      const outA = getOutcome(tipA.homeScore, tipA.awayScore);
      const outB = getOutcome(tipB.homeScore, tipB.awayScore);
      
      if (tipA.homeScore === tipB.homeScore && tipA.awayScore === tipB.awayScore) {
        score += 3;
      } else if (outA === outB) {
        const diffA = tipA.homeScore - tipA.awayScore;
        const diffB = tipB.homeScore - tipB.awayScore;
        if (diffA === diffB) {
          score += 2;
        } else {
          score += 1;
        }
      }
    }
  });
  
  if (maxScore === 0) return { percent: 0, count: 0 };
  return { percent: Math.round((score / maxScore) * 100), count: maxScore / 3 };
};

const generateCommentary = async (soulmates, hiveMind, archNemeses) => {
  const keys = await getApiKeys();
  if (!keys.gemini) return null;
  
  try {
    const genAI = new GoogleGenerativeAI(keys.gemini);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    let prompt = `You are a witty, slightly sarcastic office sports pool commentator.\n\n`;
    
    if (soulmates) {
      prompt += `Soulmates (highest similarity): ${soulmates.users.map(u => u.name).join(' & ')} with ${soulmates.sync}% sync.\n`;
    }
    if (hiveMind) {
      prompt += `Hive Mind (group of 3+ highly synced): ${hiveMind.users.map(u => u.name).join(', ')} with ${hiveMind.sync}% sync.\n`;
    }
    if (archNemeses) {
      prompt += `Arch Nemeses (lowest similarity): ${archNemeses.users.map(u => u.name).join(' & ')} with ${archNemeses.sync}% sync.\n`;
    }
    
    prompt += `\nFor each category provided above, generate a maximum of 2 sentences of funny, witty, or sarcastic office-style commentary. 
    (e.g., blessing the Soulmates' shared DNA, mocking the Hive Mind's lack of original thought, or fueling the fire between the Arch Nemeses).
    Format your response as a JSON object with keys: "soulmates", "hiveMind", "archNemeses". Only include the keys for the categories provided. Return ONLY valid JSON, no markdown formatting blocks.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    let start = text.indexOf('{');
    let end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      text = text.substring(start, end + 1);
    }
    
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to generate tip buddies commentary:", err);
    return null;
  }
};

const calculateAndCacheTipBuddies = async () => {
  try {
    const users = await getUsers();
    const allTips = await getAllTips();
    const matches = await getMatches();
    
    if (users.length < 2) return; // Not enough users
    
    // To make connections dynamic, only evaluate based on the last 10 tipped matches
    const matchesWithTips = matches.filter(m => allTips.some(t => t.matchId === m.id));
    matchesWithTips.sort((a, b) => new Date(b.kickoffTime) - new Date(a.kickoffTime));
    const recentMatchIds = matchesWithTips.slice(0, 10).map(m => m.id);
    const recentTips = allTips.filter(t => recentMatchIds.includes(t.matchId));
    
    const userTips = {};
    users.forEach(u => {
      userTips[u.id] = recentTips.filter(t => t.userId === u.id);
    });
    
    const pairs = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const u1 = users[i];
        const u2 = users[j];
        // Only consider if both have at least 1 mutual tip
        const mutual = userTips[u1.id].some(t1 => userTips[u2.id].find(t2 => t2.matchId === t1.matchId));
        if (mutual) {
          const syncData = calculateSync(userTips[u1.id], userTips[u2.id]);
          pairs.push({ u1, u2, sync: syncData.percent, count: syncData.count });
        }
      }
    }
    
    if (pairs.length === 0) return;
    
    pairs.sort((a, b) => {
      if (b.sync !== a.sync) return b.sync - a.sync; // Primary: Sync %
      if (b.count !== a.count) return b.count - a.count; // Secondary: Number of mutual tips
      return Math.random() - 0.5; // Tertiary: Random tie-breaker
    });
    const soulmatePair = pairs[0];
    const archNemesisPair = pairs[pairs.length - 1];
    
    let soulmates = {
      users: [soulmatePair.u1, soulmatePair.u2],
      sync: soulmatePair.sync,
      commentary: ""
    };
    
    let archNemeses = {
      users: [archNemesisPair.u1, archNemesisPair.u2],
      sync: archNemesisPair.sync,
      commentary: ""
    };
    
    // Find Hive Mind (triplet with highest average sync)
    let bestTriplet = null;
    let bestTripletSync = 0;
    if (users.length >= 3) {
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          for (let k = j + 1; k < users.length; k++) {
            const u1 = users[i], u2 = users[j], u3 = users[k];
            const s12 = pairs.find(p => (p.u1.id === u1.id && p.u2.id === u2.id) || (p.u1.id === u2.id && p.u2.id === u1.id))?.sync || 0;
            const s13 = pairs.find(p => (p.u1.id === u1.id && p.u2.id === u3.id) || (p.u1.id === u3.id && p.u2.id === u1.id))?.sync || 0;
            const s23 = pairs.find(p => (p.u1.id === u2.id && p.u2.id === u3.id) || (p.u1.id === u3.id && p.u2.id === u2.id))?.sync || 0;
            const avg = Math.round((s12 + s13 + s23) / 3);
            if (avg > bestTripletSync && avg > 0) {
              bestTripletSync = avg;
              bestTriplet = [u1, u2, u3];
            }
          }
        }
      }
    }
    
    let hiveMind = null;
    if (bestTriplet) {
      hiveMind = {
        users: bestTriplet,
        sync: bestTripletSync,
        commentary: ""
      };
    }

    const cached = await getTipBuddies();
    
    // Determine if we need new commentary
    let needNewCommentary = false;
    
    if (!cached) {
      needNewCommentary = true;
    } else {
      const soulNames = soulmates.users.map(u => u.name).sort().join(',');
      const cachedSoulNames = cached.soulmates?.users.map(u => u.name).sort().join(',');
      
      const archNames = archNemeses.users.map(u => u.name).sort().join(',');
      const cachedArchNames = cached.archNemeses?.users.map(u => u.name).sort().join(',');
      
      const hiveNames = hiveMind ? hiveMind.users.map(u => u.name).sort().join(',') : '';
      const cachedHiveNames = cached.hiveMind?.users.map(u => u.name).sort().join('') || '';
      
      if (soulNames !== cachedSoulNames || archNames !== cachedArchNames || hiveNames !== cachedHiveNames) {
        needNewCommentary = true;
      } else {
        // Keep old commentary
        soulmates.commentary = cached.soulmates?.commentary || "";
        archNemeses.commentary = cached.archNemeses?.commentary || "";
        if (hiveMind) hiveMind.commentary = cached.hiveMind?.commentary || "";
      }
    }
    
    if (needNewCommentary) {
      const aiResponse = await generateCommentary(soulmates, hiveMind, archNemeses);
      if (aiResponse) {
        if (aiResponse.soulmates) soulmates.commentary = aiResponse.soulmates;
        if (aiResponse.archNemeses) archNemeses.commentary = aiResponse.archNemeses;
        if (hiveMind && aiResponse.hiveMind) hiveMind.commentary = aiResponse.hiveMind;
      }
    }
    
    await setTipBuddies(soulmates, hiveMind, archNemeses);

  } catch (err) {
    console.error("Error in calculateAndCacheTipBuddies:", err);
  }
};

module.exports = {
  calculateAndCacheTipBuddies
};
