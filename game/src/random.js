// A small seeded random source so the city, the traffic and the staged
// screenshots all come out the same way from the same seed. Everything in
// the game that needs chance takes it from one of these, never from
// Math.random directly, so a ?shot= scene is the same frame every time.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  // mulberry32: cheap, good enough for a game, and stable across engines.
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
    // A fresh stream forked from this one, for a subsystem that should not
    // disturb the order of draws elsewhere.
    fork(salt) {
      return createRandom((state ^ Math.imul(salt | 0, 2654435761)) >>> 0);
    },
  };
}
