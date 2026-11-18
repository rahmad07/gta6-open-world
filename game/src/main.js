// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. Four screens: title, play, paused and
// game over. ?seed=N fixes the city. ?shot=start|play|chase|mission|foot
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, MUTE_KEY } from './config.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_MISSION, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, screenButtons } from './render.js';
import { stageShot } from './shots.js';
import { readSave, applySave } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage off: the mute lasts this visit only.
  }
}

const world = createWorld(seed, readMuted());
const renderer = createRenderer(canvas);
let activeScreen = shot ? 'shot' : SCREEN_TITLE;

function announce(message) {
  status.textContent = message;
}

// A small handle for the smoke tests (and anyone poking at the game in the
// console): the live state, plus teleport and mission starters.
window.__solmar = {
  world,
  state() {
    const p = world.player;
    return {
      screen: activeScreen,
      x: Math.round(p.x),
      y: Math.round(p.y),
      health: Math.round(p.health),
      cash: p.cash,
      wanted: world.wanted,
      inCar: !!p.inCar,
      carSpeed: p.inCar ? Math.round(p.inCar.speed) : 0,
      mission: world.mission.active ? world.mission.index : -1,
      missionStep: world.mission.step,
      completed: [...world.completedMissions],
      cars: world.cars.length,
      peds: world.peds.length,
      cops: world.police.cops.length,
      policeCars: world.cars.filter((c) => c.driver === 'police').length,
    };
  },
  teleport(x, y) {
    world.player.x = x;
    world.player.y = y;
    world.camera.x = x;
    world.camera.y = y;
  },
  startMission(index) {
    return world.startNextMission(index);
  },
};

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { x: -1, y: -1 }, !!readSave(), null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let overKind = null;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;
  let buttons = [];

  function setScreen(next) {
    screen = next;
    activeScreen = next;
  }

  function startMusic() {
    world.audio.unlock();
    world.audio.music(true);
  }

  function stopPlayAudio() {
    world.audio.engine(false);
    world.audio.siren(false);
    world.audio.music(false);
  }

  function newGame() {
    world.player.cash = 0;
    world.completedMissions = [];
    world.mission.active = false;
    world.mission.step = 0;
    world.marker = null;
    world.wanted = 0;
    const garage = world.city.landmarks.garage;
    world.player.x = garage.x;
    world.player.y = garage.y + 130;
    world.player.health = 100;
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
    save = null;
    setScreen(SCREEN_PLAY);
    startMusic();
    announce('Playing. Steal a car and press Q for the first job.');
  }

  function continueGame() {
    const data = readSave();
    if (data) applySave(world, data);
    setScreen(SCREEN_PLAY);
    startMusic();
    announce('Playing. Welcome back to Vistamar.');
  }

  function startGame() {
    if (save) continueGame();
    else newGame();
  }

  function pauseGame() {
    setScreen(SCREEN_PAUSED);
    stopPlayAudio();
    announce('Paused.');
  }

  function resumeGame() {
    setScreen(SCREEN_PLAY);
    startMusic();
    announce('Playing.');
  }

  function endGame(kind) {
    overKind = kind;
    setScreen(SCREEN_OVER);
    stopPlayAudio();
    world.audio.fail();
    announce(kind === 'wasted' ? 'Wasted.' : 'Busted.');
  }

  function respawn() {
    world.respawn(overKind);
    setScreen(SCREEN_PLAY);
    startMusic();
    announce('Playing.');
  }

  function clickButton(id) {
    if (id === 'start') startGame();
    else if (id === 'new') newGame();
    else if (id === 'resume') resumeGame();
    else if (id === 'save') {
      world.saveGame();
      save = readSave();
      world.toast = { text: 'Game saved', until: world.time + 2 };
      world.audio.pickup();
    } else if (id === 'restart') {
      newGame();
    } else if (id === 'quit') {
      setScreen(SCREEN_TITLE);
      save = readSave();
      stopPlayAudio();
      announce('Vistamar. Press Space or click to start.');
    } else if (id === 'respawn') {
      respawn();
    }
  }

  function buttonAt(x, y) {
    for (const b of buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }

  function aimWorld() {
    const mouse = input.mouse();
    const zoom = world.camera.zoom;
    return {
      x: world.camera.x + (mouse.x - window.innerWidth / 2) / zoom,
      y: world.camera.y + (mouse.y - window.innerHeight / 2) / zoom,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = !world.audio.isMuted();
      world.audio.setMuted(muted);
      writeMuted(muted);
      world.toast = { text: muted ? 'Sound off' : 'Sound on', until: world.time + 2 };
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) respawn();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) resumeGame();
      return;
    }
    // Playing.
    if (actions & ACTION_PAUSE) {
      pauseGame();
      return;
    }
    if (actions & ACTION_ENTER_CAR) world.tryEnterCar();
    if (actions & ACTION_MISSION) {
      if (world.startNextMission()) {
        // The banner announces the job.
      } else if (!world.mission.active) {
        world.toast = { text: 'No more jobs — the story is done', until: world.time + 3 };
      }
    }
  }

  function handleClick() {
    if (!input.takeClick()) return;
    const mouse = input.mouse();
    const id = buttonAt(mouse.x, mouse.y);
    if (id) {
      clickButton(id);
      return;
    }
    // A click outside any button starts the game from the title or
    // respawns from the game-over screen; in play it is just a shot.
    if (screen === SCREEN_TITLE) startGame();
    else if (screen === SCREEN_OVER) respawn();
  }

  function stepPlay() {
    world.step(STEP, input, aimWorld());
    for (const event of world.events) {
      if (event === 'wasted') endGame('wasted');
      else if (event === 'busted') endGame('busted');
    }
    world.events.length = 0;
  }

  const neutralInput = {
    moveX: () => 0,
    moveY: () => 0,
    running: () => false,
    mouse: () => ({ x: 0, y: 0, down: false, clicked: false }),
    takeClick: () => false,
    takeActions: () => 0,
  };

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick();
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic drives, the camera
      // drifts slowly over the centre of town.
      while (accumulator >= STEP) {
        world.step(STEP, neutralInput, null);
        accumulator -= STEP;
      }
      titleTime += 1 / 60;
      const cx = world.city.size / 2;
      world.camera.x = cx + Math.cos(titleTime * 0.07) * 480;
      world.camera.y = cx + Math.sin(titleTime * 0.07) * 480;
      world.camera.zoom = 0.85;
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepPlay();
        accumulator -= STEP;
      }
      if (screen !== SCREEN_PLAY) accumulator = 0;
    } else {
      accumulator = 0;
    }
    buttons = renderer.draw(world, screen, input.mouse(), !!save, overKind);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) pauseGame();
  });

  announce('Vistamar. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
