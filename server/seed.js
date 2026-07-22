const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../worldcup.db');
const db = new sqlite3.Database(dbPath);

const seed = async () => {
  const hash = await bcrypt.hash('password123', 10);
  
  db.serialize(() => {
    // Clear existing
    db.run("DELETE FROM users");
    db.run("DELETE FROM matches");
    db.run("DELETE FROM tips");
    
    // Add 3 demo users
    db.run("INSERT INTO users (id, name, email, department, password, score) VALUES (?, ?, ?, ?, ?, ?)", 
      ['demo1', 'Alice Demo', 'alice@example.com', 'The Desk-Side Defenders (Inter Local FC)', hash, 45]);
    db.run("INSERT INTO users (id, name, email, department, password, score) VALUES (?, ?, ?, ?, ?, ?)", 
      ['demo2', 'Bob Demo', 'bob@example.com', 'Control-Alt-Defeat (Real CTC)', hash, 30]);
    db.run("INSERT INTO users (id, name, email, department, password, score) VALUES (?, ?, ?, ?, ?, ?)", 
      ['demo3', 'Charlie Demo', 'charlie@example.com', 'The Smooth Operators (Atlético RTC)', hash, 60]);

    // Add 3 demo matches
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    db.run("INSERT INTO matches (id, homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['m1', 'Germany', 'France', tomorrow.toISOString(), 'Group Stage', null, null, 'SCHEDULED', 'France']);
    db.run("INSERT INTO matches (id, homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['m2', 'Brazil', 'Argentina', tomorrow.toISOString(), 'Group Stage', null, null, 'SCHEDULED', 'Argentina']);
    db.run("INSERT INTO matches (id, homeTeam, awayTeam, kickoffTime, stage, homeScore, awayScore, status, underdog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['m3', 'Spain', 'Italy', tomorrow.toISOString(), 'Group Stage', null, null, 'SCHEDULED', 'Italy']);

    console.log("Database seeded successfully with 3 demo users and 3 demo matches.");
    console.log("Demo user passwords are 'password123'");
  });
};

seed();
