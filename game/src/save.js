// Saving: one localStorage key holds the cash, the story progress and
// where Jax was standing. Loading puts him back there with a clean wanted
// level. Storage can be off (private windows): then saving quietly does
// nothing and the run just lasts this visit.
import { SAVE_KEY } from './config.js';

export function saveToStorage(world) {
  try {
    const data = {
      version: 1,
      cash: world.player.cash,
      completedMissions: world.completedMissions,
      x: Math.round(world.player.x),
      y: Math.round(world.player.y),
      health: Math.round(world.player.health),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(world, data) {
  world.player.cash = data.cash || 0;
  world.completedMissions = Array.isArray(data.completedMissions) ? data.completedMissions : [];
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    world.player.x = data.x;
    world.player.y = data.y;
    world.camera.x = data.x;
    world.camera.y = data.y;
  }
  if (typeof data.health === 'number') world.player.health = data.health;
}
