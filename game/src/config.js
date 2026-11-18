// Neon Bay — every number the game balances on lives here, so one tweak
// retunes the whole city. Nothing in here knows about the DOM.

export const WORLD = { w: 3600, h: 2600 };
export const ROAD_W = 120;
export const LANE = 34; // lane offset from a road's centre line (right-hand traffic)
export const ROADS_V = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_H = [250, 750, 1250, 1750, 2250];
export const BEACH_Y = 2400; // sand strip starts here
export const SEA_Y = 2520; // water starts here

// Sun-soaked palette: warm asphalt, sand, and loud building colours.
export const PALETTE = {
  ground: '#cbb98f',
  block: '#d8c9a3',
  road: '#3d3a38',
  roadEdge: '#2e2b29',
  laneMark: '#e8c85a',
  crosswalk: '#e8e4d8',
  sidewalk: '#b7a77e',
  sea: '#2f7fb8',
  sand: '#e0c98f',
  park: '#5d9b4a',
  parkPath: '#c9b489',
  lot: '#8d8578',
  building: ['#e07856', '#4fa3a5', '#d9a441', '#7d6ba8', '#5b8c5a', '#c25e7a', '#5a7fb8', '#b8643c'],
  roof: '#00000022',
  neon: ['#ff5ad1', '#37f2e2', '#ffe14d', '#7dff5a'],
};

export const PLAYER = {
  hp: 100,
  walk: 235,
  sprint: 355,
  radius: 14,
  pistolDamage: 34,
  pistolRate: 0.22, // seconds between shots
  pistolRange: 520,
  pistolMag: 12,
  punchDamage: 18,
  punchRate: 0.45,
  punchRange: 46,
  bulletSpeed: 780,
};

export const CAR = {
  accel: 620,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6, // radians per second at full lock
  grip: 6.0, // how fast lateral velocity dies
  radius: 20,
  hp: 100,
  ramDamage: 6, // police ram, per hit — a chase stays a chase instead of
  ramCooldown: 1.2, // totalling the car in a few seconds
};

export const TRAFFIC = {
  count: 26,
  speed: 150,
  speedVar: 45,
  spawnGap: 70, // minimum gap when spawning, px
};

export const PEDS = { count: 42, walk: 55, flee: 170, radius: 9 };

// heat 0..100; wanted stars step up as heat crosses these lines.
export const WANTED_LEVELS = [0, 12, 32, 52, 72, 90];
export const HEAT = {
  steal: 26,
  shoot: 3, // per shot fired in the open
  killPed: 22,
  killCop: 32,
  decay: 2.2, // per second while no crime in the last few seconds
  grace: 4, // seconds after a crime before decay resumes
};

export const POLICE = {
  carSpeed: 540, // patrol cars keep pace with a fast driver, so a chase is
  copSpeed: 205, // a chase instead of a parade the player outruns for free
  copShootRange: 380,
  copShootRate: 0.9,
  copDamage: 7,
  bustRadius: 46,
  bustTime: 1.2,
  maxCars: 5,
  maxCops: 3,
};

export const GANG = { hp: 100, shootRange: 420, shootRate: 1.5, damage: 8, count: 6 };

export const PICKUP = { health: 40, ammo: 24 };

export const CLOCK_START_MIN = 9 * 60; // the game clock starts at 09:00
export const MINIMAP = 190; // minimap size in px
