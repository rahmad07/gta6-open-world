// The city's other road users: traffic cars that keep to their lanes and
// turn at intersections, and pedestrians who stroll the sidewalks and run
// when something violent happens near them. Parked cars come from the
// city's parking bays and are just cars with no driver.
import { CAR, CITY, PED_COUNT, TRAFFIC_COUNT } from './config.js';
import { isRoad, randomRoadPoint, randomSidewalkPoint, roadCenters } from './city.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'taxi', 'van', 'sport', 'truck'];

function laneOffset(axis, dir) {
  return dir > 0 ? 16 : -16;
}

function spawnTrafficCar(world, rng) {
  const centers = roadCenters();
  const horizontal = rng.chance(0.5);
  const road = centers[rng.int(0, CITY.blocks)];
  const dir = rng.chance(0.5) ? 1 : -1;
  const along = rng.range(80, CITY.size - 80);
  const off = laneOffset(horizontal ? 'h' : 'v', dir);
  const kind = rng.pick(TRAFFIC_KINDS);
  return {
    x: horizontal ? along : road + off,
    y: horizontal ? road + off : along,
    angle: horizontal ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2,
    speed: rng.range(55, 105),
    targetSpeed: rng.range(60, 110),
    kind,
    color: (CAR.kinds[kind] || CAR.kinds.sedan).color,
    driver: 'traffic',
    axis: horizontal ? 'h' : 'v',
    dir,
    turnCooldown: rng.range(0.5, 2),
  };
}

function carAhead(world, car) {
  let nearest = null;
  let nearestDist = 90;
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = car.axis === 'h' ? dx * car.dir : dy * car.dir;
    const across = car.axis === 'h' ? Math.abs(dy) : Math.abs(dx);
    if (along > 0 && along < nearestDist && across < 22) {
      nearest = other;
      nearestDist = along;
    }
  }
  return { car: nearest, dist: nearestDist };
}

function updateTrafficCar(world, car, dt) {
  const centers = roadCenters();
  car.turnCooldown -= dt;
  // At an intersection, sometimes turn onto the crossing road.
  const onCrossing = centers.some((c) => Math.abs((car.axis === 'h' ? car.x : car.y) - c) < 10);
  if (onCrossing && car.turnCooldown <= 0 && world.rng.chance(0.3)) {
    car.turnCooldown = world.rng.range(2, 5);
    const newDir = world.rng.chance(0.5) ? 1 : -1;
    if (car.axis === 'h') {
      const road = centers.reduce((best, c) => (Math.abs(c - car.x) < Math.abs(best - car.x) ? c : best), centers[0]);
      car.axis = 'v';
      car.dir = newDir;
      car.x = road + laneOffset('v', newDir);
      car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = centers.reduce((best, c) => (Math.abs(c - car.y) < Math.abs(best - car.y) ? c : best), centers[0]);
      car.axis = 'h';
      car.dir = newDir;
      car.y = road + laneOffset('h', newDir);
      car.angle = newDir > 0 ? 0 : Math.PI;
    }
  }
  // Slow for the car ahead, stop if it is right there.
  const ahead = carAhead(world, car);
  let want = car.targetSpeed;
  if (ahead.car) want = ahead.dist < 42 ? 0 : Math.min(want, Math.max(0, ahead.car.speed ?? 40));
  car.speed += Math.max(-260 * dt, Math.min(120 * dt, want - car.speed));
  if (car.axis === 'h') car.x += car.dir * car.speed * dt;
  else car.y += car.dir * car.speed * dt;
  // Wrap around the city edge instead of piling up at the border.
  if (car.x < 20 || car.x > CITY.size - 20 || car.y < 20 || car.y > CITY.size - 20) {
    const fresh = spawnTrafficCar(world, world.rng);
    Object.assign(car, fresh);
  }
}

function spawnPed(world, rng) {
  const spot = randomSidewalkPoint(world.city, rng);
  return {
    x: spot.x,
    y: spot.y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    state: 'walk',
    fleeTimer: 0,
    fleeX: 0,
    fleeY: 0,
    downTimer: 0,
    shirt: world.rng.pick(['#e2574c', '#4f8fd0', '#7ab648', '#d07ab0', '#e08a3c', '#8a6fc0']),
    axis: rng.chance(0.5) ? 'h' : 'v',
    dir: rng.chance(0.5) ? 1 : -1,
    turnCooldown: rng.range(1, 4),
  };
}

function updatePed(world, ped, dt) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      const fresh = spawnPed(world, world.rng);
      Object.assign(ped, fresh);
    }
    return;
  }
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    ped.x += Math.cos(a) * 200 * dt;
    ped.y += Math.sin(a) * 200 * dt;
    ped.angle = a;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
    return;
  }
  ped.turnCooldown -= dt;
  const centers = roadCenters();
  const pos = ped.axis === 'h' ? ped.x : ped.y;
  const onCrossing = centers.some((c) => Math.abs(pos - c) < 12);
  if (onCrossing && ped.turnCooldown <= 0 && world.rng.chance(0.25)) {
    ped.turnCooldown = world.rng.range(2, 6);
    ped.axis = ped.axis === 'h' ? 'v' : 'h';
    ped.dir = world.rng.chance(0.5) ? 1 : -1;
  }
  const speed = ped.speed;
  if (ped.axis === 'h') {
    ped.x += ped.dir * speed * dt;
    ped.angle = ped.dir > 0 ? 0 : Math.PI;
  } else {
    ped.y += ped.dir * speed * dt;
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  if (ped.x < 30 || ped.x > CITY.size - 30 || ped.y < 30 || ped.y > CITY.size - 30) {
    const fresh = spawnPed(world, world.rng);
    Object.assign(ped, fresh);
  }
}

export function createTraffic(world) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(spawnTrafficCar(world, world.rng));
  // Parked cars from the city's bays: most of them, so the streets feel full.
  const spots = [...world.city.parkedSpots];
  for (let i = spots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(world.rng.next() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (const spot of spots.slice(0, 12)) {
    const kind = spot.kind === 'cop' ? 'cop' : world.rng.pick(TRAFFIC_KINDS);
    cars.push({
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      speed: 0,
      targetSpeed: 0,
      kind,
      color: (CAR.kinds[kind] || CAR.kinds.sedan).color,
      driver: null,
      axis: 'h',
      dir: 1,
      turnCooldown: 0,
    });
  }
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) peds.push(spawnPed(world, world.rng));
  return { cars, peds };
}

export function updateTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.driver === 'traffic') updateTrafficCar(world, car, dt);
  }
  for (const ped of world.peds) updatePed(world, ped, dt);
}

// Everyone nearby runs from a gunshot, an explosion or a car ploughing in.
export function scareNearbyPeds(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

// A car (usually the player's) hitting a pedestrian: they go down, the
// street notices, and the law notices too.
export function hitPedWithCar(world, ped, car) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 10;
  world.particles.crash(ped.x, ped.y);
  world.audio.crash(0.5);
  scareNearbyPeds(world, ped.x, ped.y, 260);
  if (car.driver === 'player') world.addCrime(1, ped.x, ped.y);
}

export function isOnRoadPoint(x, y) {
  return isRoad(x, y);
}

export function randomRoadPointNear(world, x, y, minDist, maxDist) {
  return randomRoadPoint(world.city, world.rng, x, y, minDist, maxDist);
}
