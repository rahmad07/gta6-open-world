// The screenshot scenes behind ?shot=start|play|chase|mission|foot. Each
// one plays the real rules forward from a fresh seeded world for a fixed
// number of steps, steered by a small autopilot (drive toward a waypoint,
// turn toward the objective), so the frame is what a short session really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { enterCar } from './player.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// A driver that follows the roads: it routes to the target through the
// intersections (out to the nearest road, along it, across, then in),
// steers toward the next waypoint, and reverses out and re-plans when it
// stops making progress. It drives the real car with the real physics, so
// the frame shows the game as it plays — on the road, not in a wall.
import { roadCenters } from './city.js';

function nearestCenter(centers, value) {
  return centers.reduce((best, c) => (Math.abs(c - value) < Math.abs(best - value) ? c : best), centers[0]);
}

function createDriver(world, finalTarget) {
  const centers = roadCenters();
  let waypoints = [];
  let current = 0;
  let lastX = 0;
  let lastY = 0;
  let stuck = 0;
  let reversing = 0;

  function plan(car) {
    const nearH = nearestCenter(centers, car.y);
    const nearV = nearestCenter(centers, car.x);
    const targetV = nearestCenter(centers, finalTarget.x);
    const targetH = nearestCenter(centers, finalTarget.y);
    waypoints = [
      { x: car.x, y: nearH },
      { x: targetV, y: nearH },
      { x: targetV, y: targetH },
      { x: finalTarget.x, y: finalTarget.y },
    ];
    current = 0;
    lastX = car.x;
    lastY = car.y;
    stuck = 0;
  }

  const driver = {
    moveX() {
      const car = world.player.inCar;
      if (!car) return 0;
      const target = waypoints[current] ?? finalTarget;
      const want = Math.atan2(target.y - car.y, target.x - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      return reversing > 0 ? -steer : steer;
    },
    moveY() {
      return reversing > 0 ? 1 : -1;
    },
    running() {
      return false;
    },
    mouse() {
      return { x: 0, y: 0, down: false, clicked: false };
    },
    takeClick() {
      return false;
    },
    takeActions() {
      return 0;
    },
    tick() {
      const car = world.player.inCar;
      if (!car) return;
      if (waypoints.length === 0) plan(car);
      if (reversing > 0) {
        reversing -= STEP;
        return;
      }
      const moved = Math.hypot(car.x - lastX, car.y - lastY);
      if (moved < 5) stuck += STEP;
      else stuck = 0;
      lastX = car.x;
      lastY = car.y;
      const target = waypoints[current];
      if (target && Math.hypot(target.x - car.x, target.y - car.y) < 55) current += 1;
      if (current >= waypoints.length || stuck > 1.6) {
        stuck = 0;
        if (current < waypoints.length) reversing = 1.0;
        plan(car);
      }
    },
  };
  return driver;
}

function walkerInput(world, target, shooting) {
  return {
    moveX() {
      const dx = target.x - world.player.x;
      return Math.abs(dx) > 12 ? Math.sign(dx) : 0;
    },
    moveY() {
      const dy = target.y - world.player.y;
      return Math.abs(dy) > 12 ? Math.sign(dy) : 0;
    },
    running() {
      return true;
    },
    mouse() {
      return { x: 640, y: 200, down: shooting, clicked: false };
    },
    takeClick() {
      return false;
    },
    takeActions() {
      return 0;
    },
    tick() {},
  };
}

function stepWorld(world, input, seconds, aim) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, input, aim ?? null);
    if (input.tick) input.tick();
  }
}

// Prefer a parked car, so the shot reads as Jax taking a car off the
// street rather than a carjacking in progress.
function putPlayerInParkedCar(world) {
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.driver !== null) continue;
    const d = Math.hypot(car.x - world.player.x, car.y - world.player.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return null;
  world.player.x = best.x + 30;
  world.player.y = best.y;
  enterCar(world, best);
  return best;
}

export function stageShot(name, world) {
  if (name === 'start') {
    // A busy intersection, five seconds in: the title card sits over it.
    const idle = createDriver(world, { x: world.city.size / 2, y: world.city.size / 2 });
    stepWorld(world, idle, 5, null);
    world.camera.x = 1328;
    world.camera.y = 1004;
    world.camera.zoom = 0.9;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    putPlayerInParkedCar(world);
    world.wanted = 3;
    world.timeSinceCrime = 0;
    const mall = world.city.landmarks.mall;
    stepWorld(world, createDriver(world, { x: mall.x, y: mall.y }), 14, null);
    world.camera.zoom = 0.95;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(world, 1);
    putPlayerInParkedCar(world);
    const docks = world.city.landmarks.docks;
    stepWorld(world, createDriver(world, { x: docks.x, y: docks.y }), 13, null);
    world.camera.zoom = 0.95;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    // On foot where the pedestrians are: Jax opens fire beside a group on
    // the sidewalk, they scatter, and the law takes notice. The frame is
    // taken while they are still running.
    let anchor = null;
    for (const a of world.peds) {
      for (const b of world.peds) {
        if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 150) {
          anchor = a;
          break;
        }
      }
      if (anchor) break;
    }
    anchor = anchor ?? world.peds[0];
    const p = world.player;
    p.x = anchor.x + 110;
    p.y = anchor.y + 40;
    world.camera.x = p.x;
    world.camera.y = p.y;
    const aim = { x: anchor.x, y: anchor.y };
    stepWorld(world, walkerInput(world, { x: p.x + 60, y: p.y }, true), 2.0, aim);
    stepWorld(world, walkerInput(world, { x: p.x + 160, y: p.y }, false), 1.0, null);
    world.camera.zoom = 0.95;
    return { screen: SCREEN_PLAY };
  }
  // 'play' and anything else: driving through the city with the HUD up.
  putPlayerInParkedCar(world);
  const mall = world.city.landmarks.mall;
  stepWorld(world, createDriver(world, { x: mall.x, y: mall.y }), 18, null);
  world.camera.zoom = 0.95;
  return { screen: SCREEN_PLAY };
}
