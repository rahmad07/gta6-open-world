// The world: everything that exists in Vistamar at once — the city, the
// player, the cars, the pedestrians, the police, the bullets, the mission
// in progress — and one step() that moves it all forward. It owns no
// drawing and no screen: main.js asks it to step and reads its events.
import { CAR } from './config.js';
import { createRandom } from './random.js';
import { generateCity, resolveCircle, pointInBuilding } from './city.js';
import { createPlayer, updateOnFoot, driveCar, enterCar, exitCar, damagePlayer } from './player.js';
import { createTraffic, updateTraffic, scareNearbyPeds, hitPedWithCar } from './traffic.js';
import { createPolice, updatePolice, clearPolice } from './police.js';
import { createParticles } from './particles.js';
import { createSoundBank } from './audio.js';
import { MISSIONS, createMissionState, startMission, updateMission, damageGuard, nextMissionIndex, failMission } from './missions.js';
import { saveToStorage } from './save.js';

export function createWorld(seed, muted) {
  const rng = createRandom(seed);
  const city = generateCity(rng.fork(7));
  const garage = city.landmarks.garage;
  const world = {
    seed,
    rng,
    city,
    time: 0,
    timeSinceCrime: 999,
    wanted: 0,
    player: createPlayer(garage.x, garage.y + 130),
    cars: [],
    peds: [],
    bullets: [],
    police: createPolice(),
    particles: createParticles(),
    audio: createSoundBank(muted),
    mission: createMissionState(),
    completedMissions: [],
    marker: null,
    banner: null,
    toast: null,
    events: [],
    camera: { x: garage.x, y: garage.y + 130, zoom: 1 },
  };
  const traffic = createTraffic(world);
  world.cars = traffic.cars;
  world.peds = traffic.peds;

  // --- crime -------------------------------------------------------------
  world.witnessed = (x, y) => {
    for (const ped of world.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 200) return true;
    }
    for (const cop of world.police.cops) {
      if (Math.hypot(cop.x - x, cop.y - y) < 420) return true;
    }
    for (const car of world.cars) {
      if (car.driver === 'police' && Math.hypot(car.x - x, car.y - y) < 420) return true;
    }
    return false;
  };

  world.addCrime = (stars, x, y) => {
    if (stars <= 0) return;
    world.wanted = Math.min(5, world.wanted + stars);
    world.timeSinceCrime = 0;
  };

  world.notifyGunshot = (x, y) => {
    scareNearbyPeds(world, x, y, 300);
    if (world.witnessed(x, y)) {
      world.wanted = Math.max(world.wanted, 1);
      world.timeSinceCrime = 0;
    }
  };

  // --- cars --------------------------------------------------------------
  world.nearestCar = (x, y, maxDist) => {
    let best = null;
    let bestD = maxDist;
    for (const car of world.cars) {
      if (car.driver === 'police') continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  };

  world.tryEnterCar = () => {
    const p = world.player;
    if (p.inCar) {
      exitCar(world);
      return true;
    }
    const car = world.nearestCar(p.x, p.y, 58);
    if (!car) return false;
    if (car.driver === 'traffic') {
      // The driver bails and runs; taking a car with a driver is a crime
      // if anyone sees it happen.
      const driver = {
        x: car.x, y: car.y, angle: 0, speed: 60, state: 'flee',
        fleeTimer: 3, fleeX: car.x, fleeY: car.y, downTimer: 0,
        shirt: '#e2574c', axis: 'h', dir: 1, turnCooldown: 0,
      };
      world.peds.push(driver);
      if (world.witnessed(car.x, car.y)) world.addCrime(1, car.x, car.y);
      world.toast = { text: 'Car jacked!', until: world.time + 2 };
    } else if (car.kind === 'cop') {
      world.addCrime(2, car.x, car.y);
      world.toast = { text: 'You stole a cop car!', until: world.time + 2 };
    } else if (world.witnessed(car.x, car.y)) {
      world.addCrime(1, car.x, car.y);
    }
    enterCar(world, car);
    return true;
  };

  // --- bullets ------------------------------------------------------------
  function bulletHitsCar(b) {
    for (const car of world.cars) {
      const dx = b.x - car.x;
      const dy = b.y - car.y;
      const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
      const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along < CAR.length / 2 && across < CAR.width / 2) return car;
    }
    return null;
  }

  function updateBullets(dt) {
    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const b = world.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && pointInBuilding(world.city, b.x, b.y)) {
        world.particles.sparks(b.x, b.y);
        dead = true;
      }
      if (!dead && bulletHitsCar(b)) {
        world.particles.sparks(b.x, b.y);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        for (const guard of world.mission.guards) {
          if (guard.state === 'guard' && Math.hypot(b.x - guard.x, b.y - guard.y) < 16) {
            damageGuard(world, guard, b.damage);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of world.police.cops) {
            if (Math.hypot(b.x - cop.x, b.y - cop.y) < 15) {
              cop.health -= b.damage;
              world.particles.sparks(b.x, b.y);
              if (cop.health <= 0) {
                world.police.cops.splice(world.police.cops.indexOf(cop), 1);
                world.addCrime(2, cop.x, cop.y);
              }
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const ped of world.peds) {
            if (ped.state !== 'down' && Math.hypot(b.x - ped.x, b.y - ped.y) < 14) {
              ped.state = 'down';
              ped.downTimer = 10;
              world.particles.sparks(b.x, b.y);
              scareNearbyPeds(world, ped.x, ped.y, 260);
              if (world.witnessed(ped.x, ped.y)) world.addCrime(1, ped.x, ped.y);
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && b.from === 'guard') {
        const p = world.player;
        if (Math.hypot(b.x - p.x, b.y - p.y) < 15) {
          damagePlayer(world, b.damage);
          dead = true;
        }
      }
      if (dead) world.bullets.splice(i, 1);
    }
  }

  // --- car-to-car and car-to-person contact -------------------------------
  function updateCarContacts(dt) {
    const cars = world.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 38) {
          const push = (38 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 120 && (a.driver === 'player' || b.driver === 'player')) {
            world.particles.crash((a.x + b.x) / 2, (a.y + b.y) / 2);
            world.audio.crash(rel / 400);
          }
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg;
          b.speed = avg;
        }
      }
    }
    // Cars running people over, and traffic hitting the player on foot.
    const p = world.player;
    for (const car of cars) {
      if (car.driver === 'player') continue;
      if (Math.abs(car.speed) < 30) continue;
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) hitPedWithCar(world, ped, car);
      }
      if (!p.inCar && Math.hypot(p.x - car.x, p.y - car.y) < 26) {
        damagePlayer(world, 15);
        p.x += (p.x - car.x) * 0.8;
        p.y += (p.y - car.y) * 0.8;
      }
    }
    // The player's own car running people over.
    if (p.inCar && Math.abs(p.inCar.speed) > 40) {
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y) < 28) hitPedWithCar(world, ped, p.inCar);
      }
    }
  }

  // --- camera --------------------------------------------------------------
  function updateCamera(dt) {
    const p = world.player;
    const look = p.inCar ? 0.35 : 0.12;
    const tx = p.x + Math.cos(p.angle) * (p.inCar ? Math.abs(p.inCar.speed) * look : 0);
    const ty = p.y + Math.sin(p.angle) * (p.inCar ? Math.abs(p.inCar.speed) * look : 0);
    const k = 1 - Math.exp(-5 * dt);
    world.camera.x += (tx - world.camera.x) * k;
    world.camera.y += (ty - world.camera.y) * k;
    const targetZoom = p.inCar ? 0.82 : 1;
    world.camera.zoom += (targetZoom - world.camera.zoom) * (1 - Math.exp(-2 * dt));
  }

  // --- save ------------------------------------------------------------------
  world.saveGame = () => saveToStorage(world);

  // --- respawn ---------------------------------------------------------------
  world.respawn = (kind) => {
    const p = world.player;
    const penalty = kind === 'wasted' ? 0.2 : 0.15;
    p.cash = Math.max(0, Math.floor(p.cash * (1 - penalty)));
    p.health = 100;
    world.wanted = 0;
    world.timeSinceCrime = 999;
    clearPolice(world);
    if (p.inCar) {
      p.inCar.driver = null;
      p.inCar = null;
    }
    world.audio.engine(false);
    if (world.mission.active) {
      failMission(world, kind === 'wasted' ? 'Wasted' : 'Busted');
      return;
    }
    const spot = kind === 'wasted' ? world.city.landmarks.hospital : world.city.landmarks.police;
    p.x = spot.x;
    p.y = spot.y + 130;
    resolveCircle(world.city, p, 13);
    world.camera.x = p.x;
    world.camera.y = p.y;
  };

  // --- the step --------------------------------------------------------------
  world.step = (dt, input, aimWorld) => {
    world.time += dt;
    world.timeSinceCrime += dt;
    const p = world.player;
    if (p.inCar) driveCar(world, dt, input);
    else updateOnFoot(world, dt, input, aimWorld);
    updateTraffic(world, dt);
    updatePolice(world, dt);
    updateMission(world, dt);
    updateBullets(dt);
    updateCarContacts(dt);
    world.particles.update(dt);
    updateCamera(dt);
    if (world.banner && world.time > world.banner.until) world.banner = null;
    if (world.toast && world.time > world.toast.until) world.toast = null;
  };

  world.startNextMission = (index) => {
    const next = typeof index === 'number' ? index : nextMissionIndex(world);
    if (next < 0 || world.mission.active) return false;
    return startMission(world, next);
  };

  world.missionTitle = () => {
    if (world.mission.active) return MISSIONS[world.mission.index].title;
    return null;
  };

  world.currentObjective = () => {
    if (!world.mission.active) return null;
    const mission = MISSIONS[world.mission.index];
    const step = mission.steps[world.mission.step];
    if (!step) return null;
    return { text: step.text, mission: mission.title, timer: world.mission.timer };
  };

  return world;
}
