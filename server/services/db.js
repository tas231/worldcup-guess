const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Storage } = require('@google-cloud/storage');

const isCloudRun = !!process.env.K_SERVICE;
let dbPath = isCloudRun ? '/tmp/worldcup.db' : (process.env.DB_PATH || path.join(__dirname, '../../worldcup.db'));

const db = new sqlite3.Database(dbPath);

if (isCloudRun && process.env.GCS_BUCKET_NAME) {
  const storage = new Storage();
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  let isUploading = false;
  let lastMtime = 0;

  // Background sync to GCS using safe VACUUM INTO snapshot
  setInterval(async () => {
    if (isUploading) return;
    try {
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        if (stats.mtimeMs > lastMtime) {
          isUploading = true;
          const syncPath = '/tmp/sync_snapshot.db';
          
          await new Promise((resolve, reject) => {
            db.run(`VACUUM INTO '${syncPath}'`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          await bucket.upload(syncPath, { destination: 'worldcup.db' });
          fs.unlinkSync(syncPath);
          lastMtime = stats.mtimeMs;
        }
      }
    } catch (err) {
      console.error("Failed to upload DB to GCS:", err.message);
    } finally {
      isUploading = false;
    }
  }, 10000); // 10 second sync interval
}

const initDB = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        department TEXT,
        password TEXT,
        score INTEGER DEFAULT 0,
        currentStreak INTEGER DEFAULT 0
      )`, () => {
        // Add predictedChampion column if it doesn't exist
        db.run(`ALTER TABLE users ADD COLUMN predictedChampion TEXT`, (err) => {
          // Ignore error if column already exists
        });
      });

      db.run(`CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        homeTeam TEXT,
        awayTeam TEXT,
        kickoffTime TEXT,
        stage TEXT,
        homeScore INTEGER,
        awayScore INTEGER,
        status TEXT,
        underdog TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS tips (
        id TEXT PRIMARY KEY,
        userId TEXT,
        matchId TEXT,
        homeScore INTEGER,
        awayScore INTEGER,
        jokerApplied BOOLEAN,
        points INTEGER DEFAULT 0
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        geminiApiKey TEXT,
        footballApiKey TEXT
      )`, () => {
        db.serialize(() => {
          db.run(`ALTER TABLE settings ADD COLUMN tournamentName TEXT`, () => {});
          db.run(`ALTER TABLE settings ADD COLUMN departments TEXT`, () => {});
          db.run(`ALTER TABLE settings ADD COLUMN championTeams TEXT`, () => {});
          db.run(`ALTER TABLE settings ADD COLUMN enableExternalApi INTEGER DEFAULT 1`, () => {});
          
          db.run(`INSERT OR IGNORE INTO settings (id, geminiApiKey, footballApiKey) VALUES ('default', '', '')`, () => {
            const defaultDepartments = JSON.stringify([
              "The Desk-Side Defenders (Inter Local FC)",
              "Control-Alt-Defeat (Real CTC)",
              "The Smooth Operators (Atlético RTC)"
            ]);
            const defaultChampions = JSON.stringify([
              "Argentina", "France", "Spain", "England", "Brazil", "Portugal", "Netherlands", "Germany", "Italy", "Belgium", "Croatia", "United States", "Mexico", "Uruguay"
            ]);
            
            db.run(`UPDATE settings SET tournamentName = 'World Cup Guess' WHERE id = 'default' AND tournamentName IS NULL`);
            db.run(`UPDATE settings SET departments = ? WHERE id = 'default' AND departments IS NULL`, [defaultDepartments]);
            db.run(`UPDATE settings SET championTeams = ? WHERE id = 'default' AND championTeams IS NULL`, [defaultChampions]);
          });
        });
      });

      db.run(`CREATE TABLE IF NOT EXISTS oracle (
        id INTEGER PRIMARY KEY,
        message TEXT,
        matchId TEXT,
        expiresAt TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS tip_buddies_cache (
        id INTEGER PRIMARY KEY,
        soulmates TEXT,
        hiveMind TEXT,
        archNemeses TEXT,
        updatedAt TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS active_events (
        id TEXT PRIMARY KEY,
        matchId TEXT,
        announcementText TEXT
      )`);



      const matchPromise = new Promise((res, rej) => {
        db.get(`SELECT COUNT(*) as count FROM matches`, async (err, row) => {
          if (err) return rej(err);
          if (row.count === 0) {
            try {
              const config = await getConfig();
              if (config.enableExternalApi) {
                console.log('Fetching live games from worldcup26.ir...');
                const response = await axios.get('https://worldcup26.ir/get/games');
                const games = response.data.games;

              const stadiumOffsets = {
                1: '-06:00', 2: '-06:00', 3: '-06:00',
                4: '-05:00', 5: '-05:00', 6: '-05:00',
                7: '-04:00', 8: '-04:00', 9: '-04:00', 10: '-04:00', 11: '-04:00', 12: '-04:00',
                13: '-07:00', 14: '-07:00', 15: '-07:00', 16: '-07:00'
              };

              const stmt = db.prepare(`INSERT INTO matches (id, homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
              
              for (const game of games) {
                const [datePart, timePart] = game.local_date.split(' ');
                const [mm, dd, yyyy] = datePart.split('/');
                const offset = stadiumOffsets[game.stadium_id] || '-05:00';
                const isoString = `${yyyy}-${mm}-${dd}T${timePart}:00${offset}`;
                const kickoffTime = new Date(isoString).toISOString();
                
                const stage = game.type === 'group' ? `Group ${game.group}` : game.type;
                const status = game.finished === 'TRUE' ? 'completed' : 'pending';

                stmt.run(`m${game.id}`, game.home_team_name_en, game.away_team_name_en, kickoffTime, stage, null, null, status, null);
              }
              stmt.finalize();
              console.log(`Seeded ${games.length} real World Cup 2026 matches.`);
              }
            } catch (fetchErr) {
              console.error('Failed to seed live games from API:', fetchErr.message);
            }
          }
          res();
        });
      });

      const userPromise = new Promise((res, rej) => {
        db.all("PRAGMA table_info(users)", (err, columns) => {
          if (err) return rej(err);
          const hasIsAdmin = columns.some(col => col.name === 'isAdmin');
          
          const createDefaultAdmin = async () => {
            db.get(`SELECT COUNT(*) as count FROM users`, async (err, row) => {
              if (err) return rej(err);
              if (row.count === 0) {
                console.log('No users found. Creating default admin account...');
                const hash = await bcrypt.hash('admin123', 10);
                db.run(`INSERT INTO users (id, name, email, department, password, score, isAdmin) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                  ['admin', 'Admin', 'admin@worldcup.local', 'Admins', hash, 0, 1], (err) => err ? rej(err) : res());
              } else {
                res();
              }
            });
          };

          if (!hasIsAdmin) {
            db.run("ALTER TABLE users ADD COLUMN isAdmin BOOLEAN DEFAULT 0", (alterErr) => {
              if (alterErr) rej(alterErr);
              else createDefaultAdmin();
            });
          } else {
            createDefaultAdmin();
          }
        });
      });

      Promise.all([matchPromise, userPromise])
        .then(() => resolve())
        .catch(reject);
    });
  });
};

const getMatches = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM matches ORDER BY kickoffTime ASC`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const getMatch = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM matches WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const updateMatch = (id, homeScore, awayScore, status) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE matches SET homeScore = ?, awayScore = ?, status = ? WHERE id = ?`, [homeScore, awayScore, status, id], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

const updateMatchTeams = (id, homeTeam, awayTeam, underdog) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE matches SET homeTeam = ?, awayTeam = ?, underdog = ? WHERE id = ?`, [homeTeam, awayTeam, underdog, id], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

const createMatch = (match) => {
  return new Promise((resolve, reject) => {
    const { id, homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog } = match;
    db.run(`INSERT INTO matches (id, homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, homeTeam, awayTeam, kickoffTime, stage, homeScore || null, awayScore || null, status || 'upcoming', underdog || null],
      function(err) {
        if (err) return reject(err);
        resolve();
      });
  });
};

const editMatch = (id, match) => {
  return new Promise((resolve, reject) => {
    const { homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog } = match;
    db.run(`UPDATE matches SET homeTeam = ?, awayTeam = ?, kickoffTime = ?, stage = ?, homeScore = ?, awayScore = ?, status = ?, underdog = ? WHERE id = ?`,
      [homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog, id],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
  });
};

const deleteMatch = (id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM matches WHERE id = ?`, [id], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

const getUsers = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM users ORDER BY score DESC`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const getUser = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const createUser = (user) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO users (id, name, email, department, password, score, currentStreak) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.department, user.password, 0, 0], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const getTipsForUser = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tips WHERE userId = ?`, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const getAllTips = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tips`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const submitTip = (tip) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO tips (id, userId, matchId, homeScore, awayScore, jokerApplied) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
            homeScore = excluded.homeScore, 
            awayScore = excluded.awayScore,
            jokerApplied = excluded.jokerApplied`,
      [tip.id, tip.userId, tip.matchId, tip.homeScore, tip.awayScore, tip.jokerApplied], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const updateUserScore = (userId, score) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET score = ? WHERE id = ?`, [score, userId], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const updateUserChampion = (userId, champion) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET predictedChampion = ? WHERE id = ?`, [champion, userId], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const updateTipPoints = (tipId, points) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE tips SET points = ? WHERE id = ?`, [points, tipId], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const updateUserStreak = (userId, streak) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET currentStreak = ? WHERE id = ?`, [streak, userId], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const getTipsForMatch = (matchId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tips WHERE matchId = ?`, [matchId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const updatePassword = (userId, newPassword) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [newPassword, userId], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const updateUserDepartment = (userId, department) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET department = ? WHERE id = ?`, [department, userId], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

const updateUserAdmin = (userId, isAdmin) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET isAdmin = ? WHERE id = ?`, [isAdmin ? 1 : 0, userId], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const wipeUserTips = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const rollback = (err) => db.run('ROLLBACK', () => reject(err));
      db.run('BEGIN TRANSACTION');
      db.run(`DELETE FROM tips`, function(err) { if (err) return rollback(err); });
      db.run(`UPDATE users SET score = 0, currentStreak = 0`, function(err) { if (err) return rollback(err); });
      db.run('COMMIT', function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

const wipeEntireDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const rollback = (err) => db.run('ROLLBACK', () => reject(err));
      db.run('BEGIN TRANSACTION');
      db.run(`DELETE FROM tips`, function(err) { if (err) return rollback(err); });
      db.run(`DELETE FROM oracle`, function(err) { if (err) return rollback(err); });
      db.run(`UPDATE users SET score = 0, currentStreak = 0`, function(err) { if (err) return rollback(err); });
      db.run(`UPDATE matches SET homeScore = null, awayScore = null, status = 'pending'`, function(err) { if (err) return rollback(err); });
      db.run('COMMIT', function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

const setOracleMessage = (message, matchId, expiresAt) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT OR REPLACE INTO oracle (id, message, matchId, expiresAt) VALUES (1, ?, ?, ?)`,
      [message, matchId, expiresAt], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const deleteUserAndTips = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const rollback = (err) => db.run('ROLLBACK', () => reject(err));
      db.run('BEGIN TRANSACTION');
      db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) { if (err) return rollback(err); });
      db.run(`DELETE FROM tips WHERE userId = ?`, [userId], function(err) { if (err) return rollback(err); });
      db.run('COMMIT', function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

const populateUnderdogs = () => {
  return new Promise((resolve, reject) => {
    const underdogs = {
      "m1": "South Africa", "m2": "South Korea", "m3": "Canada", "m4": "Paraguay",
      "m5": "Haiti", "m6": "Australia", "m7": "Morocco", "m8": "Qatar",
      "m9": "Ivory Coast", "m10": "Curaçao", "m11": "Japan", "m12": "Tunisia",
      "m13": "New Zealand", "m14": "Cape Verde", "m15": "Egypt", "m16": "Saudi Arabia",
      "m17": "Senegal", "m18": "Iraq", "m19": "Algeria", "m20": "Jordan",
      "m21": "Democratic Republic of the Congo", "m22": "Croatia", "m23": "Uzbekistan", "m24": "Panama",
      "m25": "South Korea", "m26": "Bosnia and Herzegovina", "m27": "Qatar", "m28": "South Africa",
      "m29": "Haiti", "m30": "Scotland", "m31": "Australia", "m32": "Paraguay",
      "m33": "Ivory Coast", "m34": "Curaçao", "m35": "Sweden", "m36": "Tunisia",
      "m37": "Iran", "m38": "New Zealand", "m39": "Saudi Arabia", "m40": "Cape Verde",
      "m41": "Iraq", "m42": "Senegal", "m43": "Austria", "m44": "Jordan",
      "m45": "Uzbekistan", "m46": "Panama", "m47": "Democratic Republic of the Congo", "m48": "Ghana",
      "m49": "Scotland", "m50": "Haiti", "m51": "South Africa", "m52": "Czech Republic",
      "m53": "Qatar", "m54": "Canada", "m55": "Curaçao", "m56": "Ecuador",
      "m57": "Australia", "m58": "Turkey", "m59": "Japan", "m60": "Tunisia",
      "m61": "Iraq", "m62": "Norway", "m63": "Iran", "m64": "New Zealand",
      "m65": "Cape Verde", "m66": "Uruguay", "m67": "Panama", "m68": "Ghana",
      "m69": "Algeria", "m70": "Jordan", "m71": "Colombia", "m72": "Uzbekistan"
    };
    db.serialize(() => {
      const stmt = db.prepare("UPDATE matches SET underdog = ? WHERE id = ?");
      for (const [id, team] of Object.entries(underdogs)) {
        stmt.run(team, id);
      }
      stmt.finalize((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
};

const getOracleMessage = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM oracle WHERE id = 1`, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const clearOracleMessage = () => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM oracle WHERE id = 1`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const getApiKeys = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT geminiApiKey, footballApiKey FROM settings WHERE id = 'default'`, (err, row) => {
      if (err) return reject(err);
      resolve({
        gemini: row?.geminiApiKey || process.env.GEMINI_API_KEY || null,
        football: row?.footballApiKey || process.env.FOOTBALL_API_KEY || null
      });
    });
  });
};

const getConfig = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM settings WHERE id = 'default'`, (err, row) => {
      if (err) return reject(err);
      
      let departments = [];
      let championTeams = [];
      try {
        departments = row?.departments ? JSON.parse(row.departments) : [];
      } catch(e){}
      try {
        championTeams = row?.championTeams ? JSON.parse(row.championTeams) : [];
      } catch(e){}
      
      resolve({
        tournamentName: row?.tournamentName || 'World Cup Guess',
        departments: departments,
        championTeams: championTeams,
        enableExternalApi: row?.enableExternalApi === 1 || row?.enableExternalApi === undefined ? true : false
      });
    });
  });
};

const updateConfig = (config) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM settings WHERE id = 'default'`, (err, row) => {
      if (err) return reject(err);
      
      const newTournamentName = config.tournamentName !== undefined ? config.tournamentName : row?.tournamentName;
      const newDepartments = config.departments !== undefined ? JSON.stringify(config.departments) : row?.departments;
      const newChampionTeams = config.championTeams !== undefined ? JSON.stringify(config.championTeams) : row?.championTeams;
      const newEnableExternalApi = config.enableExternalApi !== undefined ? (config.enableExternalApi ? 1 : 0) : row?.enableExternalApi;
      
      db.run(`UPDATE settings SET tournamentName = ?, departments = ?, championTeams = ?, enableExternalApi = ? WHERE id = 'default'`, 
        [newTournamentName, newDepartments, newChampionTeams, newEnableExternalApi], 
        function(err) {
          if (err) return reject(err);
          resolve();
        });
    });
  });
};

const setApiKeys = (geminiKey, footballKey) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT geminiApiKey, footballApiKey FROM settings WHERE id = 'default'`, (err, row) => {
      if (err) return reject(err);
      
      const newGemini = geminiKey !== undefined ? geminiKey : row?.geminiApiKey;
      const newFootball = footballKey !== undefined ? footballKey : row?.footballApiKey;
      
      db.run(`UPDATE settings SET geminiApiKey = ?, footballApiKey = ? WHERE id = 'default'`, 
        [newGemini, newFootball], 
        function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  });
};
const getTipBuddies = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM tip_buddies_cache WHERE id = 1`, (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve({
        soulmates: row.soulmates ? JSON.parse(row.soulmates) : null,
        hiveMind: row.hiveMind ? JSON.parse(row.hiveMind) : null,
        archNemeses: row.archNemeses ? JSON.parse(row.archNemeses) : null,
        updatedAt: row.updatedAt
      });
    });
  });
};

const setTipBuddies = (soulmates, hiveMind, archNemeses) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO tip_buddies_cache (id, soulmates, hiveMind, archNemeses, updatedAt) VALUES (1, ?, ?, ?, ?)`,
      [
        soulmates ? JSON.stringify(soulmates) : null,
        hiveMind ? JSON.stringify(hiveMind) : null,
        archNemeses ? JSON.stringify(archNemeses) : null,
        now
      ],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
};

const clearTipBuddiesCache = () => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM tip_buddies_cache`, function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

const getActiveEvent = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM active_events WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const updateActiveEvent = (id, matchId, announcementText) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO active_events (id, matchId, announcementText) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET matchId=excluded.matchId, announcementText=excluded.announcementText`,
      [id, matchId, announcementText], function(err) {
        if (err) return reject(err);
        resolve();
    });
  });
};

const clearActiveEvent = (id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM active_events WHERE id = ?`, [id], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

module.exports = {
  initDB,
  getMatches,
  getMatch,
  updateMatch,
  getUsers,
  getUser,
  createUser,
  getTipsForUser,
  getAllTips,
  submitTip,
  updateUserScore,
  updateTipPoints,
  updateUserStreak,
  getTipsForMatch,
  updatePassword,
  updateMatchTeams,
  updateUserAdmin,
  updateUserDepartment,
  wipeUserTips,
  wipeEntireDatabase,
  setOracleMessage,
  getOracleMessage,
  clearOracleMessage,
  deleteUserAndTips,
  getApiKeys,
  setApiKeys,
  populateUnderdogs,
  getTipBuddies,
  setTipBuddies,
  clearTipBuddiesCache,
  getActiveEvent,
  updateActiveEvent,
  clearActiveEvent,
  updateUserChampion,
  getConfig,
  updateConfig,
  createMatch,
  editMatch,
  deleteMatch
};
