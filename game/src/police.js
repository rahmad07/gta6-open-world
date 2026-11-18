// The law: the wanted level, the foot cops who chase the player down and
// the patrol cars that hunt along the roads. Police drive the grid like
// traffic but always toward the player, switching roads at intersections
// to close the distance. Get caught standing still next to one and the
// run is over.
import { WANTED } from './config.js';
import { randomRoadPoint, resolveCircle, roadCenters } from './city.js';
import { damagePlayer } from './player.js';

export function createPolice() {
  return {
    cops: [],
    decayTimer: 0,
    bustTimer: 0,
  };
}

function spawnFootCop(world) {
  const spot = randomRoadPoint(world.city, world.rng, world.player.x, world.player.y, 280, 520);
  return { x: spot.x, y: spot.y, angle: 0, holdTimer: 0, health: 100, kind: 'foot' };
}

function spawnPoliceCar(world) {
  const spot = randomRoadPoint(world.city, world.rng, world.player.x, world.player.y, 420, 700);
  return {
    x: spot.x,
    y: spot.y,
    angle: 0,
    speed: 0,
    targetSpeed: 0,
    kind: 'cop',
    color: '#2c3440',
    driver: 'police',
    axis: 'h',
    dir: 1,
    turnCooldown: 0,
    stuckTimer: 0,
    lastX: spot.x,
    lastY: spot.y,
  };
}

function nearestPoliceDistance(world) {
  let best = Infinity;
  for (const cop of world.police.cops) best = Math.min(best, Math.hypot(cop.x - world.player.x, cop.y - world.player.y));
  for (const car of world.cars) {
    if (car.driver === 'police') best = Math.min(best, Math.hypot(car.x - world.player.x, car.y - world.player.y));
  }
  return best;
}

function updateFootCop(world, cop, dt) {
  const p = world.player;
  const speed = WANTED.copFootSpeed[Math.min(5, world.wanted)];
  const dx = p.x - cop.x;
  const dy = p.y - cop.y;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    cop.x += (dx / d) * speed * dt;
    cop.y += (dy / d) * speed * dt;
    cop.angle = Math.atan2(dy, dx);
  }
  resolveCircle(world.city, cop, 12);
  if (d < 46 && !p.inCar) {
    cop.holdTimer += dt;
    if (cop.holdTimer > WANTED.bustHoldSeconds) world.events.push('busted');
  } else {
    cop.holdTimer = Math.max(0, cop.holdTimer - dt * 2);
  }
}

function updatePoliceCar(world, car, dt) {
  const p = world.player;
  const speed = WANTED.copCarSpeed[Math.min(5, world.wanted)];
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const desiredAxis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
  const centers = roadCenters();
  car.turnCooldown -= dt;
  // At an intersection, switch onto the road that closes the distance.
  const pos = car.axis === 'h' ? car.x : car.y;
  const onCrossing = centers.some((c) => Math.abs(pos - c) < 12);
  if (onCrossing && car.axis !== desiredAxis && car.turnCooldown <= 0) {
    car.turnCooldown = 1.2;
    if (desiredAxis === 'h') {
      const road = centers.reduce((best, c) => (Math.abs(c - car.y) < Math.abs(best - car.y) ? c : best), centers[0]);
      car.axis = 'h';
      car.y = road + (dy > 0 ? 16 : -16);
      car.dir = dx > 0 ? 1 : -1;
    } else {
      const road = centers.reduce((best, c) => (Math.abs(c - car.x) < Math.abs(best - car.x) ? c : best), centers[0]);
      car.axis = 'v';
      car.x = road + (dx > 0 ? 16 : -16);
      car.dir = dy > 0 ? 1 : -1;
    }
  }
  // Drive along the current road toward the player.
  const along = car.axis === 'h' ? dx : dy;
  car.dir = along > 0 ? 1 : -1;
  car.angle = car.axis === 'h' ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  car.speed += Math.max(-400 * dt, Math.min(300 * dt, speed - car.speed));
  if (car.axis === 'h') car.x += car.dir * car.speed * dt;
  else car.y += car.dir * car.speed * dt;
  // A patrol car that has not moved in a while is stuck on something: put
  // it back on a road near the player instead of letting it sit there.
  const moved = Math.hypot(car.x - car.lastX, car.y - car.lastY);
  if (moved < 4) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  car.lastX = car.x;
  car.lastY = car.y;
  if (car.stuckTimer > 3) {
    const spot = randomRoadPoint(world.city, world.rng, p.x, p.y, 380, 620);
    car.x = spot.x;
    car.y = spot.y;
    car.speed = 0;
    car.stuckTimer = 0;
  }
  // Ramming the player on foot hurts.
  if (!p.inCar && Math.hypot(car.x - p.x, car.y - p.y) < 34) {
    damagePlayer(world, 12);
    p.x += (p.x - car.x) * 0.4;
    p.y += (p.y - car.y) * 0.4;
  }
}

export function updatePolice(world, dt) {
  const police = world.police;
  const wanted = world.wanted;
  const wantCars = WANTED.cars[Math.min(5, wanted)];
  const wantFoot = WANTED.foot[Math.min(5, wanted)];

  // Foot cops.
  while (police.cops.length < wantFoot) police.cops.push(spawnFootCop(world));
  while (police.cops.length > wantFoot) police.cops.pop();
  for (const cop of police.cops) updateFootCop(world, cop, dt);

  // Patrol cars live in the world's car list.
  const patrol = world.cars.filter((c) => c.driver === 'police');
  if (patrol.length < wantCars) {
    world.cars.push(spawnPoliceCar(world));
  } else if (patrol.length > wantCars) {
    const extra = patrol[patrol.length - 1];
    world.cars.splice(world.cars.indexOf(extra), 1);
  }
  for (const car of world.cars) {
    if (car.driver === 'police') updatePoliceCar(world, car, dt);
  }

  // Busted: standing still next to a patrol car while wanted.
  const p = world.player;
  const nearCar = patrol.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 78);
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : Math.abs(p.speed);
  if (wanted > 0 && nearCar && playerSpeed < 25) {
    police.bustTimer += dt;
    if (police.bustTimer > WANTED.bustHoldSeconds + 0.4) world.events.push('busted');
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }

  // The heat dies down when the player has been quiet and unseen.
  const nearest = nearestPoliceDistance(world);
  if (world.timeSinceCrime > WANTED.decayQuietSeconds && nearest > 500) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decayStepSeconds) {
      police.decayTimer = 0;
      world.wanted = Math.max(0, world.wanted - 1);
    }
  } else {
    police.decayTimer = 0;
  }

  // Sirens when a patrol car is anywhere near.
  const sirenNear = patrol.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 750);
  world.audio.siren(sirenNear && wanted > 0);
}

export function clearPolice(world) {
  world.police.cops = [];
  world.cars = world.cars.filter((c) => c.driver !== 'police');
  world.audio.siren(false);
}
