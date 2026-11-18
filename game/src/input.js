// Keyboard and mouse, read by the loop. Held keys are a live set; one-shot
// presses (enter a car, pause, mute, confirm) are queued as actions and
// taken once, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;
export const ACTION_MISSION = 32;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyQ') actions |= ACTION_MISSION;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.add(event.code);
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  const has = (...codes) => codes.some((c) => held.has(c));

  return {
    // -1/0/1 on each axis, from WASD or the arrow keys.
    moveX() {
      return (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
    },
    moveY() {
      return (has('KeyS', 'ArrowDown') ? 1 : 0) - (has('KeyW', 'ArrowUp') ? 1 : 0);
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked };
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
