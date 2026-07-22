const mockTeams = [
  { id: 'MEX', name: 'Mexico', group: 'A' },
  { id: 'RSA', name: 'South Africa', group: 'A' },
  { id: 'KOR', name: 'South Korea', group: 'A' },
  { id: 'CZE', name: 'Czechia', group: 'A' },
  
  { id: 'CAN', name: 'Canada', group: 'B' },
  { id: 'BIH', name: 'Bosnia and Herzegovina', group: 'B' },
  { id: 'ENG', name: 'England', group: 'B' },
  { id: 'SEN', name: 'Senegal', group: 'B' },
  
  { id: 'USA', name: 'USA', group: 'D' },
  { id: 'PAR', name: 'Paraguay', group: 'D' },
  { id: 'FRA', name: 'France', group: 'D' },
  { id: 'ESP', name: 'Spain', group: 'D' },
];

const now = new Date();
// Set kickoff times to explicit future dates for testing (e.g. tomorrow)
const day1 = new Date(now.getTime() + 1000 * 60 * 60 * 24); 
const day2 = new Date(now.getTime() + 1000 * 60 * 60 * 48); 
const r32Date = new Date(now.getTime() + 1000 * 60 * 60 * 96); 

const mockMatches = [
  // Group A
  { id: 'm1', homeTeam: 'MEX', awayTeam: 'RSA', kickoffTime: day1.toISOString(), stage: 'Group A', homeScore: null, awayScore: null, status: 'pending', underdog: 'RSA' },
  { id: 'm2', homeTeam: 'KOR', awayTeam: 'CZE', kickoffTime: day1.toISOString(), stage: 'Group A', homeScore: null, awayScore: null, status: 'pending', underdog: 'KOR' },
  // Group B
  { id: 'm3', homeTeam: 'CAN', awayTeam: 'BIH', kickoffTime: day1.toISOString(), stage: 'Group B', homeScore: null, awayScore: null, status: 'pending', underdog: 'BIH' },
  // Group D
  { id: 'm4', homeTeam: 'USA', awayTeam: 'PAR', kickoffTime: day2.toISOString(), stage: 'Group D', homeScore: null, awayScore: null, status: 'pending', underdog: 'PAR' },
  
  // Round of 32 (Dynamically populated by cron)
  { id: 'r32_1', homeTeam: '1A (TBD)', awayTeam: '2B (TBD)', kickoffTime: r32Date.toISOString(), stage: 'Round of 32', homeScore: null, awayScore: null, status: 'pending', underdog: null },
  { id: 'r32_2', homeTeam: '1B (TBD)', awayTeam: '2A (TBD)', kickoffTime: r32Date.toISOString(), stage: 'Round of 32', homeScore: null, awayScore: null, status: 'pending', underdog: null },
  { id: 'r32_3', homeTeam: '1D (TBD)', awayTeam: '3A/B (TBD)', kickoffTime: r32Date.toISOString(), stage: 'Round of 32', homeScore: null, awayScore: null, status: 'pending', underdog: null }
];

module.exports = { mockTeams, mockMatches };
