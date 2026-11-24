// The city of Coral Bay, built once from the seeded random: roads, blocks of
// buildings, parks, the beach, the docks and the pickup spots. Nothing here
// moves; world.js owns everything that does.
import { PALETTE, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';

function roadRects() {
  const rects = [];
  for (const x of ROADS_V) rects.push({ x: x - ROAD_W / 2, y: 0, w: ROAD_W, h: WORLD.height });
  for (const y of ROADS_H) rects.push({ x: 0, y: y - ROAD_W / 2, w: WORLD.width, h: ROAD_W });
  return rects;
}

function onRoad(x, y) {
  for (const cx of ROADS_V) if (Math.abs(x - cx) < ROAD_W / 2 + 6) return true;
  for (const cy of ROADS_H) if (Math.abs(y - cy) < ROAD_W / 2 + 6) return true;
  return false;
}

function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const cx of ROADS_V) for (const cy of ROADS_H) {
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
  }
  return best;
}

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...ROADS_V, WORLD.width];
  const ys = [0, ...ROADS_H, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The south strip is beach, the east strip by the water is docks.
      if (y0 > 2100) continue;
      if (x0 > 2850 && y0 > 1500) continue;
      if (random() < 0.22) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const count = 1 + Math.floor(random() * 3);
      for (let k = 0; k < count; k += 1) {
        const w = 90 + random() * 130;
        const h = 80 + random() * 120;
        const x = x0 + random() * Math.max(1, x1 - x0 - w);
        const y = y0 + random() * Math.max(1, y1 - y0 - h);
        buildings.push({
          x, y, w, h,
          color: PALETTE.building[Math.floor(random() * PALETTE.building.length)],
          roof: random() < 0.5,
        });
      }
    }
  }
  // Fixed landmarks the missions point at, kept clear of buildings.
  const landmarks = {
    marina: { x: 2800, y: 400, label: 'Marina' },
    docks: { x: 3050, y: 1800, label: 'Docks' },
    warehouse: { x: 1600, y: 1000, label: 'Warehouse' },
    safehouse: { x: 400, y: 2000, label: 'Safehouse' },
    hospital: { x: 1000, y: 400, label: 'Hospital' },
  };
  // Pickups: cash on sidewalks, health by the hospital, ammo by the warehouse.
  const pickups = [];
  const cashSpots = [[700, 700], [1300, 1300], [1900, 700], [2500, 1300], [700, 1700], [1900, 1700], [2500, 700], [1300, 2200]];
  for (const [x, y] of cashSpots) pickups.push({ kind: 'cash', x, y, value: 50 + Math.floor(random() * 3) * 50, taken: false });
  pickups.push({ kind: 'health', x: 1000, y: 520, value: 40, taken: false });
  pickups.push({ kind: 'health', x: 2200, y: 520, value: 40, taken: false });
  pickups.push({ kind: 'health', x: 400, y: 1880, value: 40, taken: false });
  pickups.push({ kind: 'ammo', x: 1600, y: 1120, value: 24, taken: false });
  pickups.push({ kind: 'ammo', x: 2800, y: 520, value: 24, taken: false });
  pickups.push({ kind: 'ammo', x: 1000, y: 1720, value: 24, taken: false });
  return {
    buildings, parks, roads: roadRects(), landmarks, pickups,
    beach: { x: 0, y: 2250, w: WORLD.width, h: 150 },
    water: { x: 0, y: 2330, w: WORLD.width, h: 70 },
    docks: { x: 2920, y: 1650, w: 280, h: 300 },
    onRoad, nearestRoadPoint,
  };
}

// True when the point is inside a building (cars and people cannot pass).
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps; returns the building hit, if any.
export function resolveBuildings(city, p, r) {
  let hit = null;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
      hit = b;
    } else if (d2 <= 0.01) {
      p.y = b.y - r;
      hit = b;
    }
  }
  return hit;
}
