// The story: four jobs for Delia Ramos, Jax's fixer, against the Harbor
// Kings crew. Each mission is data (steps with a type and a target) plus a
// little state; updateMission walks the steps, spawns the guards and cash
// bags a step needs, and pays out when the last step lands. Q starts the
// next job when one is waiting.
export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Wheels for Delia',
    giver: 'Delia Ramos',
    brief: 'Delia needs a set of wheels for a client. Take any car on the street and bring it to her garage.',
    reward: 300,
    steps: [
      { type: 'getCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'go', landmark: 'garage', radius: 90, inCar: true, text: "Bring the car to Delia's Garage" },
    ],
  },
  {
    id: 'package',
    title: 'The Package',
    giver: 'Delia Ramos',
    brief: 'A package is waiting at the Harbor Docks. Pick it up and drop it at the mall. Keep it quiet.',
    reward: 600,
    steps: [
      { type: 'go', landmark: 'docks', radius: 80, text: 'Go to the Harbor Docks' },
      { type: 'pickup', landmark: 'docks', radius: 70, text: 'Pick up the package', onPickup: 'heat' },
      { type: 'go', landmark: 'mall', radius: 90, text: 'Deliver the package to Vistamar Mall' },
    ],
  },
  {
    id: 'midnight',
    title: 'Midnight Run',
    giver: 'Delia Ramos',
    brief: 'The Kings are watching the streets tonight. Grab the parcel at the mall and get it to the safehouse in 150 seconds — the cops are already on you.',
    reward: 900,
    timer: 150,
    startWanted: 2,
    steps: [
      { type: 'pickup', landmark: 'mall', radius: 70, text: 'Grab the parcel at the mall' },
      { type: 'go', landmark: 'safehouse', radius: 90, text: 'Reach the safehouse before the timer runs out' },
    ],
  },
  {
    id: 'harbor',
    title: 'The Harbor Job',
    giver: 'Delia Ramos',
    brief: 'The Harbor Kings stashed three cash bags at the docks. Their guards are armed. Take the bags and lose the cops at the safehouse.',
    reward: 2000,
    startWanted: 0,
    steps: [
      { type: 'go', landmark: 'docks', radius: 90, text: 'Get to the Harbor Docks' },
      { type: 'collect', landmark: 'docks', count: 3, guards: 4, radius: 120, text: 'Collect the 3 cash bags — watch for guards' },
      { type: 'go', landmark: 'safehouse', radius: 90, text: 'Escape to the safehouse', onStart: 'heat3' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    timer: null,
    collected: 0,
    spots: [],
    guards: [],
    failed: false,
  };
}

export function nextMissionIndex(world) {
  return world.completedMissions.length >= MISSIONS.length ? -1 : world.completedMissions.length;
}

function landmarkPoint(world, name) {
  const mark = world.city.landmarks[name];
  return mark ? { x: mark.x, y: mark.y } : { x: world.city.size / 2, y: world.city.size / 2 };
}

function setMarker(world, step) {
  if (!step) {
    world.marker = null;
    return;
  }
  if (step.landmark) {
    const p = landmarkPoint(world, step.landmark);
    world.marker = { x: p.x, y: p.y, label: step.text };
  } else {
    world.marker = null;
  }
}

export function startMission(world, index) {
  const mission = MISSIONS[index];
  if (!mission) return false;
  const m = world.mission;
  m.index = index;
  m.step = 0;
  m.active = true;
  m.failed = false;
  m.timer = mission.timer ?? null;
  m.collected = 0;
  m.spots = [];
  m.guards = [];
  if (mission.startWanted) world.wanted = Math.max(world.wanted, mission.startWanted);
  world.banner = { title: mission.title, sub: `${mission.giver}: ${mission.brief}`, until: world.time + 6 };
  setMarker(world, mission.steps[0]);
  world.audio.sting();
  return true;
}

function setupStep(world, step) {
  const m = world.mission;
  m.spots = [];
  m.guards = [];
  if (step.type === 'collect') {
    const center = landmarkPoint(world, step.landmark);
    for (let i = 0; i < step.count; i += 1) {
      const a = (i / step.count) * Math.PI * 2 + 0.6;
      m.spots.push({
        x: center.x + Math.cos(a) * 90,
        y: center.y + Math.sin(a) * 90,
        taken: false,
      });
    }
    for (let i = 0; i < (step.guards ?? 0); i += 1) {
      const a = world.rng.range(0, Math.PI * 2);
      m.guards.push({
        x: center.x + Math.cos(a) * 130,
        y: center.y + Math.sin(a) * 130,
        angle: 0,
        health: 100,
        fireCooldown: world.rng.range(0.4, 1.4),
        state: 'guard',
      });
    }
  }
  setMarker(world, step);
}

function stepDone(world, step) {
  const p = world.player;
  if (step.type === 'getCar') return !!p.inCar;
  if (step.type === 'go' || step.type === 'pickup') {
    const target = landmarkPoint(world, step.landmark);
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (step.inCar && !p.inCar) return false;
    return d < (step.radius ?? 80);
  }
  if (step.type === 'collect') return m_collected(world) >= (step.count ?? 0);
  return false;
}

function m_collected(world) {
  return world.mission.spots.filter((s) => s.taken).length;
}

function completeMission(world) {
  const mission = MISSIONS[world.mission.index];
  world.player.cash += mission.reward;
  world.completedMissions.push(mission.id);
  world.mission.active = false;
  world.marker = null;
  world.banner = { title: 'Job done', sub: `${mission.title} — +$${mission.reward}`, until: world.time + 4 };
  world.audio.sting();
  world.saveGame();
  if (nextMissionIndex(world) >= 0) {
    world.toast = { text: 'Next job available — press Q to start it', until: world.time + 6 };
  } else {
    world.toast = { text: 'Story complete — Vistamar is yours. Free roam!', until: world.time + 8 };
  }
}

export function failMission(world, reason) {
  const mission = MISSIONS[world.mission.index];
  world.mission.active = false;
  world.mission.failed = true;
  world.marker = null;
  world.wanted = 0;
  world.audio.fail();
  world.banner = { title: 'Job failed', sub: `${mission.title}: ${reason}`, until: world.time + 4 };
  // Back on your feet at the garage, ready to try again.
  const garage = landmarkPoint(world, 'garage');
  world.player.x = garage.x;
  world.player.y = garage.y + 120;
  if (world.player.inCar) {
    world.player.inCar.driver = null;
    world.player.inCar = null;
  }
  world.player.health = 100;
}

export function updateMission(world, dt) {
  const m = world.mission;
  if (!m.active) return;
  const mission = MISSIONS[m.index];
  if (mission.timer && m.timer !== null) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(world, 'Out of time');
      return;
    }
  }
  // Cash bags are picked up by walking or driving over them.
  for (const spot of m.spots) {
    if (spot.taken) continue;
    if (Math.hypot(world.player.x - spot.x, world.player.y - spot.y) < 42) {
      spot.taken = true;
      world.particles.sparkle(spot.x, spot.y);
      world.audio.pickup();
      world.player.cash += 50;
    }
  }
  // Guards shoot at the player when close enough.
  for (const guard of m.guards) {
    if (guard.state !== 'guard') continue;
    const d = Math.hypot(world.player.x - guard.x, world.player.y - guard.y);
    guard.angle = Math.atan2(world.player.y - guard.y, world.player.x - guard.x);
    guard.fireCooldown -= dt;
    if (d < 320 && guard.fireCooldown <= 0) {
      guard.fireCooldown = 1.15;
      const a = guard.angle + (world.rng.next() - 0.5) * 0.3;
      world.bullets.push({
        x: guard.x + Math.cos(a) * 18,
        y: guard.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 520,
        vy: Math.sin(a) * 520,
        life: 1.1,
        damage: 9,
        from: 'guard',
      });
      world.particles.muzzle(guard.x + Math.cos(a) * 20, guard.y + Math.sin(a) * 20, a);
      world.audio.guardShot();
    }
  }
  const step = mission.steps[m.step];
  if (!step) return;
  if (stepDone(world, step)) {
    if (step.onPickup === 'heat') {
      world.wanted = Math.max(world.wanted, 1);
      world.banner = { title: 'Spotted!', sub: 'Someone called the cops — lose them.', until: world.time + 3 };
    }
    m.step += 1;
    if (m.step >= mission.steps.length) {
      completeMission(world);
      return;
    }
    const next = mission.steps[m.step];
    if (next.onStart === 'heat3') world.wanted = Math.max(world.wanted, 3);
    setupStep(world, next);
    world.audio.pickup();
  }
}

// A guard hit by a player bullet: they go down and stay down.
export function damageGuard(world, guard, amount) {
  if (guard.state !== 'guard') return;
  guard.health -= amount;
  if (guard.health <= 0) {
    guard.state = 'down';
    world.particles.sparks(guard.x, guard.y);
  }
}
