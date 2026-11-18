// Every tuning number and colour in one place. The world is a fixed-size
// city measured in pixels; the camera scales it to the window, so no rule
// below depends on the screen size.

export const STEP = 1 / 60;
export const SAVE_KEY = 'vistamar.save.v1';
export const MUTE_KEY = 'vistamar.muted.v1';

export const CITY_NAME = 'Vistamar';
export const PLAYER_NAME = 'Jax Moreno';

// The grid: 8 blocks a side, roads between them. Road centres sit at
// roadWidth/2 + i * pitch, so the city is a clean square.
export const CITY = {
  blocks: 8,
  blockSize: 260,
  roadWidth: 64,
  pitch: 324,
  get size() {
    return this.blocks * this.pitch + this.roadWidth;
  },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 255,
  health: 100,
  fireRate: 0.22,
  bulletSpeed: 720,
  bulletDamage: 34,
};

export const CAR = {
  length: 46,
  width: 22,
  radius: 13,
  accel: 340,
  brake: 520,
  reverseMax: 120,
  drag: 0.55,
  grip: 2.6,
  kinds: {
    sedan: { maxSpeed: 330, color: '#c94f43' },
    taxi: { maxSpeed: 320, color: '#f2c230' },
    van: { maxSpeed: 260, color: '#7d8a99' },
    sport: { maxSpeed: 430, color: '#3f7fd0' },
    truck: { maxSpeed: 240, color: '#8a6f4d' },
    cop: { maxSpeed: 400, color: '#2c3440' },
  },
};

// How many police hunt the player at each wanted level (index = stars).
export const WANTED = {
  cars: [0, 1, 2, 3, 4, 4],
  foot: [0, 1, 2, 3, 3, 4],
  copCarSpeed: [0, 225, 240, 260, 285, 300],
  copFootSpeed: [0, 165, 175, 190, 205, 215],
  decayQuietSeconds: 20,
  decayStepSeconds: 8,
  bustHoldSeconds: 1.2,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const GUARD_COUNT = 4;

export const PALETTE = {
  backdrop: '#0d1420',
  grass: '#4d8a4a',
  park: '#3f7a3e',
  sand: '#d9c48a',
  water: '#2e6f9e',
  road: '#33373f',
  roadLine: '#d8c95a',
  sidewalk: '#8d929b',
  roofA: '#7a5a44',
  roofB: '#5d6b7a',
  roofC: '#8a6d4f',
  roofD: '#6b5a7a',
  roofE: '#4f6b5a',
  wall: '#3a3f47',
  tree: '#2f6b2f',
  player: '#f2c230',
  playerShirt: '#e2574c',
  cop: '#2c4a7a',
  guard: '#5a2d2d',
  pedShirt: ['#e2574c', '#4f8fd0', '#7ab648', '#d07ab0', '#e08a3c', '#8a6fc0'],
  text: '#f2f4f7',
  muted: '#9aa3b0',
  gold: '#f2c230',
  star: '#f2c230',
  mission: '#ffd23e',
  danger: '#e5534b',
  panel: 'rgba(12, 18, 30, 0.92)',
  panelLine: 'rgba(255, 255, 255, 0.14)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
