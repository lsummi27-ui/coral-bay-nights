// Every tuning number, colour and mission in one place. Coral Bay is a fixed
// 3200x2400 top-down city: five vertical and four horizontal roads, blocks of
// buildings between them, a beach along the south edge and docks in the east.
// The renderer shows a 1280x720 logical view and scales it to the window.
export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const ROADS_V = [400, 1000, 1600, 2200, 2800];
export const ROADS_H = [400, 1000, 1600, 2000];
export const ROAD_W = 96;

export const PLAYER = {
  radius: 14,
  walk: 210,
  run: 330,
  health: 100,
  punchRange: 46,
  punchDamage: 25,
  punchCooldown: 0.4,
  shootCooldown: 0.25,
  shootDamage: 34,
  shootRange: 520,
  startAmmo: 36,
};

export const CAR = {
  width: 44,
  length: 78,
  accel: 420,
  brake: 700,
  reverse: 160,
  maxSpeed: 540,
  turn: 3.4,
  health: 100,
};

export const POLICE = { speed: 470, ramDamage: 8, maxCars: 4 };
export const PED = { speed: 55, fleeSpeed: 150 };
export const TRAFFIC = { count: 12, speedMin: 120, speedMax: 190 };
export const PICKUPS = { cash: 8, health: 3, ammo: 3 };

// Wanted: crimes add stars, quiet time takes them away again.
export const WANTED = { max: 5, quietSeconds: 12, decaySeconds: 8 };

export const MISSIONS = [
  {
    id: 1, title: 'First Wheels', contact: 'Vera',
    brief: 'Vera needs wheels. Steal any car and bring it to the Marina.',
    objective: 'Steal a car, then drive to the Marina marker',
    target: { x: 2800, y: 400 }, reward: 400,
  },
  {
    id: 2, title: 'The Drop', contact: 'Vera',
    brief: 'A package for the Docks. The police are already watching. Drive fast, stay cool.',
    objective: 'Deliver the package to the Docks',
    target: { x: 3050, y: 1800 }, reward: 800, wanted: 2,
  },
  {
    id: 3, title: 'Payback', contact: 'Marcus',
    brief: 'The Sharks jumped Marcus at the warehouse. Go on foot and settle it. Three of them.',
    objective: 'Defeat the three Sharks at the warehouse',
    target: { x: 1600, y: 1000 }, reward: 1200, enemies: 3,
  },
  {
    id: 4, title: 'The Getaway', contact: 'Vera',
    brief: 'The whole force is coming. Lose them and reach the safehouse. Do not stop.',
    objective: 'Escape the police and reach the safehouse',
    target: { x: 400, y: 2000 }, reward: 2000, wanted: 3, timeLimit: 90,
  },
];

export const STORY = {
  title: 'CORAL BAY NIGHTS',
  tagline: 'An open-world crime story in the sun-soaked city of Coral Bay.',
  intro: 'Rook is back in Coral Bay with $60, a borrowed jacket and a debt to the Marlin Crew. Vera has work. Marcus has a grudge. The police have everyone\'s number.',
};

export const PALETTE = {
  grass: '#7fae5a', grassDark: '#6d9c4c', road: '#3d4148', roadLine: '#e8d44d',
  sidewalk: '#9aa0a8', building: ['#e8b04b', '#d96f4e', '#4fa8a0', '#e8dcc8', '#c65b7c', '#7a9cc6'],
  water: '#3d8fc2', sand: '#e8d9a8', park: '#5d8f4a', player: '#f2f2f2',
  police: '#2b4acb', gang: '#8e2f2f', text: '#f5f1e6', muted: '#b9b3a4',
  hud: 'rgba(12,14,20,0.72)', gold: '#f2c94c', red: '#e5534b', green: '#6fbf5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'coral-bay-nights.save.v1';
export const BEST_KEY = 'coral-bay-nights.best.v1';
