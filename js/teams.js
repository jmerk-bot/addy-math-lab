// Opponent WNBA teams (everyone except the Minnesota Lynx).
// Addy can pick who the Lynx are playing against before tip-off, or tap
// Random to draw an opponent for the game.

export const TEAMS = {
  dream: { id: 'dream', city: 'Atlanta', name: 'Dream', full: 'Atlanta Dream', abbr: 'ATL', logo: 'img/teams/dream.svg' },
  sky: { id: 'sky', city: 'Chicago', name: 'Sky', full: 'Chicago Sky', abbr: 'CHI', logo: 'img/teams/sky.svg' },
  sun: { id: 'sun', city: 'Connecticut', name: 'Sun', full: 'Connecticut Sun', abbr: 'CON', logo: 'img/teams/sun.svg' },
  wings: { id: 'wings', city: 'Dallas', name: 'Wings', full: 'Dallas Wings', abbr: 'DAL', logo: 'img/teams/wings.svg' },
  valkyries: { id: 'valkyries', city: 'Golden State', name: 'Valkyries', full: 'Golden State Valkyries', abbr: 'GSV', logo: 'img/teams/valkyries.svg' },
  fever: { id: 'fever', city: 'Indiana', name: 'Fever', full: 'Indiana Fever', abbr: 'IND', logo: 'img/teams/fever.svg' },
  aces: { id: 'aces', city: 'Las Vegas', name: 'Aces', full: 'Las Vegas Aces', abbr: 'LVA', logo: 'img/teams/aces.svg' },
  sparks: { id: 'sparks', city: 'Los Angeles', name: 'Sparks', full: 'Los Angeles Sparks', abbr: 'LAS', logo: 'img/teams/sparks.svg' },
  liberty: { id: 'liberty', city: 'New York', name: 'Liberty', full: 'New York Liberty', abbr: 'NYL', logo: 'img/teams/liberty.svg' },
  mercury: { id: 'mercury', city: 'Phoenix', name: 'Mercury', full: 'Phoenix Mercury', abbr: 'PHX', logo: 'img/teams/mercury.svg' },
  fire: { id: 'fire', city: 'Portland', name: 'Fire', full: 'Portland Fire', abbr: 'POR', logo: 'img/teams/fire.svg' },
  storm: { id: 'storm', city: 'Seattle', name: 'Storm', full: 'Seattle Storm', abbr: 'SEA', logo: 'img/teams/storm.svg' },
  tempo: { id: 'tempo', city: 'Toronto', name: 'Tempo', full: 'Toronto Tempo', abbr: 'TOR', logo: 'img/teams/tempo.svg' },
  mystics: { id: 'mystics', city: 'Washington', name: 'Mystics', full: 'Washington Mystics', abbr: 'WAS', logo: 'img/teams/mystics.svg' }
};

export const TEAM_IDS = Object.keys(TEAMS);

export function getTeam(id) {
  return TEAMS[id] || TEAMS.liberty;
}

export function pickRandomTeam(excludeId = '') {
  const pool = TEAM_IDS.filter((id) => id !== excludeId);
  const choices = pool.length ? pool : TEAM_IDS;
  return choices[Math.floor(Math.random() * choices.length)];
}
