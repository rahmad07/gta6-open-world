// The city of Vistamar: a seeded grid of roads and blocks, built once per
// world. It owns the static geometry (roads, buildings, trees, parked-car
// spots, landmarks) and the spatial questions the rest of the game asks:
// is this point on a road, does this circle touch a building, where can a
// car park, where is the nearest road. Nothing here moves.
import { CITY, PALETTE } from './config.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

// Block (bx, by) -> what it is. Everything else is generic or a lot/park.
const LANDMARKS = {
  '0,0': 'safehouse',
  '1,1': 'garage',
  '6,1': 'hospital',
  '3,3': 'park',
  '4,4': 'mall',
  '2,5': 'park',
  '2,6': 'police',
  '7,7': 'docks',
};

export const LANDMARK_LABELS = {
  safehouse: 'Safehouse',
  garage: "Delia's Garage",
  hospital: 'St. Vistamar Hospital',
  mall: 'Vistamar Mall',
  police: 'Vistamar Police HQ',
  docks: 'Harbor Docks',
};

export function roadCenters() {
  const centers = [];
  for (let i = 0; i <= CITY.blocks; i += 1) centers.push(CITY.roadWidth / 2 + i * CITY.pitch);
  return centers;
}

export function blockRect(bx, by) {
  const centers = roadCenters();
  const x = centers[bx] + CITY.roadWidth / 2;
  const y = centers[by] + CITY.roadWidth / 2;
  return { x, y, w: CITY.blockSize, h: CITY.blockSize };
}

function buildingAt(city, x, y, w, h, kind, color, label) {
  const b = { x, y, w, h, kind, color, label: label ?? null };
  city.buildings.push(b);
  return b;
}

function scatterTrees(city, rng, rect, count) {
  for (let i = 0; i < count; i += 1) {
    city.trees.push({
      x: rect.x + rng.range(18, rect.w - 18),
      y: rect.y + rng.range(18, rect.h - 18),
      r: rng.range(9, 15),
    });
  }
}

function genericBlock(city, rng, bx, by) {
  const rect = blockRect(bx, by);
  // Two buildings split by a random line, each inset from the block edge.
  const vertical = rng.chance(0.5);
  const split = rng.range(0.42, 0.58);
  if (vertical) {
    const w1 = rect.w * split - 16;
    const w2 = rect.w * (1 - split) - 16;
    buildingAt(city, rect.x + 10, rect.y + 14, w1, rect.h - 28, 'house', rng.pick(ROOFS));
    buildingAt(city, rect.x + rect.w * split + 6, rect.y + 14, w2, rect.h - 28, 'house', rng.pick(ROOFS));
  } else {
    const h1 = rect.h * split - 16;
    const h2 = rect.h * (1 - split) - 16;
    buildingAt(city, rect.x + 14, rect.y + 10, rect.w - 28, h1, 'house', rng.pick(ROOFS));
    buildingAt(city, rect.x + 14, rect.y + rect.h * split + 6, rect.w - 28, h2, 'house', rng.pick(ROOFS));
  }
  scatterTrees(city, rng, rect, rng.int(0, 3));
}

function lotBlock(city, rng, bx, by) {
  const rect = blockRect(bx, by);
  city.lots.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  // Two rows of marked bays; the world parks cars in them. They face
  // along the row (east or west) so a car can always drive out of the lot
  // instead of nosing straight into the block behind it.
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      city.parkedSpots.push({
        x: rect.x + 40 + col * 52,
        y: rect.y + 62 + row * 120,
        angle: rng.chance(0.5) ? 0 : Math.PI,
      });
    }
  }
  scatterTrees(city, rng, rect, rng.int(1, 2));
}

function parkBlock(city, rng, bx, by) {
  const rect = blockRect(bx, by);
  city.parks.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  scatterTrees(city, rng, rect, rng.int(9, 13));
}

export function generateCity(rng) {
  const city = {
    size: CITY.size,
    buildings: [],
    trees: [],
    lots: [],
    parks: [],
    parkedSpots: [],
    containers: [],
    landmarks: {},
  };
  for (let by = 0; by < CITY.blocks; by += 1) {
    for (let bx = 0; bx < CITY.blocks; bx += 1) {
      const kind = LANDMARKS[`${bx},${by}`];
      const rect = blockRect(bx, by);
      if (kind === 'park') {
        parkBlock(city, rng, bx, by);
        continue;
      }
      if (kind === 'garage') {
        buildingAt(city, rect.x + 30, rect.y + 40, 200, 120, 'garage', '#b07a3a', LANDMARK_LABELS.garage);
        city.landmarks.garage = { x: rect.x + 130, y: rect.y + 100, block: { bx, by } };
        city.parkedSpots.push({ x: rect.x + 60, y: rect.y + 200, angle: 0 });
        city.parkedSpots.push({ x: rect.x + 140, y: rect.y + 200, angle: 0 });
        continue;
      }
      if (kind === 'mall') {
        buildingAt(city, rect.x + 14, rect.y + 14, 232, 232, 'mall', '#7a6a9a', LANDMARK_LABELS.mall);
        city.landmarks.mall = { x: rect.x + 130, y: rect.y + 130, block: { bx, by } };
        continue;
      }
      if (kind === 'safehouse') {
        buildingAt(city, rect.x + 70, rect.y + 60, 120, 100, 'safehouse', '#4f6b5a', LANDMARK_LABELS.safehouse);
        city.landmarks.safehouse = { x: rect.x + 130, y: rect.y + 110, block: { bx, by } };
        scatterTrees(city, rng, rect, 5);
        continue;
      }
      if (kind === 'hospital') {
        buildingAt(city, rect.x + 20, rect.y + 30, 220, 150, 'hospital', '#d8d8d2', LANDMARK_LABELS.hospital);
        city.landmarks.hospital = { x: rect.x + 130, y: rect.y + 105, block: { bx, by } };
        continue;
      }
      if (kind === 'police') {
        buildingAt(city, rect.x + 30, rect.y + 50, 200, 130, 'police', '#3a5a7a', LANDMARK_LABELS.police);
        city.landmarks.police = { x: rect.x + 130, y: rect.y + 115, block: { bx, by } };
        city.parkedSpots.push({ x: rect.x + 60, y: rect.y + 210, angle: 0, kind: 'cop' });
        city.parkedSpots.push({ x: rect.x + 140, y: rect.y + 210, angle: 0, kind: 'cop' });
        continue;
      }
      if (kind === 'docks') {
        city.lots.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
        for (let i = 0; i < 8; i += 1) {
          city.containers.push({
            x: rect.x + 20 + (i % 4) * 58,
            y: rect.y + 24 + Math.floor(i / 4) * 90,
            w: 48,
            h: 70,
            color: rng.pick(['#b0492f', '#2f7a8a', '#8a7a2f', '#4f6b8a']),
          });
        }
        city.landmarks.docks = { x: rect.x + 130, y: rect.y + 200, block: { bx, by } };
        continue;
      }
      const roll = rng.next();
      if (roll < 0.18) lotBlock(city, rng, bx, by);
      else genericBlock(city, rng, bx, by);
    }
  }
  // A few street parking bays along the roads, for cars to steal.
  const centers = roadCenters();
  for (let i = 0; i < 10; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = centers[rng.int(1, CITY.blocks - 1)];
    const along = rng.range(140, CITY.size - 140);
    if (horizontal) city.parkedSpots.push({ x: along, y: road + 22, angle: 0 });
    else city.parkedSpots.push({ x: road + 22, y: along, angle: Math.PI / 2 });
  }
  return city;
}

// --- spatial questions -----------------------------------------------------

export function isRoad(x, y) {
  const half = CITY.roadWidth / 2;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  for (const c of city.containers) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
  }
  return false;
}

// Push a circle out of every building and container it overlaps, and keep it
// inside the city. Returns true when anything pushed.
export function resolveCircle(city, obj, radius) {
  let hit = false;
  const push = (rx, ry, rw, rh) => {
    const cx = Math.max(rx, Math.min(obj.x, rx + rw));
    const cy = Math.max(ry, Math.min(obj.y, ry + rh));
    const dx = obj.x - cx;
    const dy = obj.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) return;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      obj.x = cx + (dx / d) * radius;
      obj.y = cy + (dy / d) * radius;
    } else {
      // Dead centre inside the rect: push out along the shortest side.
      const left = obj.x - rx;
      const right = rx + rw - obj.x;
      const top = obj.y - ry;
      const bottom = ry + rh - obj.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) obj.x = rx - radius;
      else if (m === right) obj.x = rx + rw + radius;
      else if (m === top) obj.y = ry - radius;
      else obj.y = ry + rh + radius;
    }
    hit = true;
  };
  for (const b of city.buildings) push(b.x, b.y, b.w, b.h);
  for (const c of city.containers) push(c.x, c.y, c.w, c.h);
  const m = radius + 4;
  if (obj.x < m) { obj.x = m; hit = true; }
  if (obj.y < m) { obj.y = m; hit = true; }
  if (obj.x > city.size - m) { obj.x = city.size - m; hit = true; }
  if (obj.y > city.size - m) { obj.y = city.size - m; hit = true; }
  return hit;
}

// A random point on a road, between minDist and maxDist from (x, y).
export function randomRoadPoint(city, rng, x, y, minDist, maxDist) {
  const centers = roadCenters();
  for (let tries = 0; tries < 24; tries += 1) {
    const horizontal = rng.chance(0.5);
    const road = centers[rng.int(0, CITY.blocks)];
    const along = rng.range(0, CITY.size);
    const px = horizontal ? along : road;
    const py = horizontal ? road : along;
    const d = Math.hypot(px - x, py - y);
    if (d >= minDist && d <= maxDist) return { x: px, y: py };
  }
  const road = centers[rng.int(0, CITY.blocks)];
  return { x: road, y: rng.range(0, CITY.size) };
}

// A random point on a sidewalk: just off a road, not inside a building.
export function randomSidewalkPoint(city, rng) {
  const centers = roadCenters();
  for (let tries = 0; tries < 24; tries += 1) {
    const horizontal = rng.chance(0.5);
    const road = centers[rng.int(0, CITY.blocks)];
    const along = rng.range(40, CITY.size - 40);
    const off = (rng.chance(0.5) ? 1 : -1) * (CITY.roadWidth / 2 + 8);
    const px = horizontal ? along : road + off;
    const py = horizontal ? road + off : along;
    if (!pointInBuilding(city, px, py)) return { x: px, y: py };
  }
  return { x: CITY.size / 2, y: CITY.size / 2 };
}
