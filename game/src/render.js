// Drawing only: the city, the cars and the people in it, then the HUD,
// then the menu screens. The camera sits on the player and zooms out a
// little when driving; everything off-screen is skipped.
import { CITY, PALETTE, FONT } from './config.js';
import { roadCenters } from './city.js';
import { drawHud, drawBanner } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const BUTTON_W = 300;
const BUTTON_H = 52;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The clickable buttons for a menu screen, in screen pixels, so the loop
// can hit-test the mouse against exactly what is drawn.
export function screenButtons(screen, w, h, saveExists) {
  const cx = w / 2 - BUTTON_W / 2;
  if (screen === SCREEN_TITLE) {
    const list = [{ id: 'start', label: saveExists ? 'Continue' : 'Start game', x: cx, y: h / 2 + 30, w: BUTTON_W, h: BUTTON_H }];
    if (saveExists) list.push({ id: 'new', label: 'New game', x: cx, y: h / 2 + 96, w: BUTTON_W, h: BUTTON_H });
    return list;
  }
  if (screen === SCREEN_PAUSED) {
    return [
      { id: 'resume', label: 'Resume', x: cx, y: h / 2 - 130, w: BUTTON_W, h: BUTTON_H },
      { id: 'save', label: 'Save game', x: cx, y: h / 2 - 64, w: BUTTON_W, h: BUTTON_H },
      { id: 'restart', label: 'Restart story', x: cx, y: h / 2 + 2, w: BUTTON_W, h: BUTTON_H },
      { id: 'quit', label: 'Quit to title', x: cx, y: h / 2 + 68, w: BUTTON_W, h: BUTTON_H },
    ];
  }
  if (screen === SCREEN_OVER) {
    return [
      { id: 'respawn', label: 'Get back on your feet', x: cx, y: h / 2 + 40, w: BUTTON_W, h: BUTTON_H },
      { id: 'quit', label: 'Quit to title', x: cx, y: h / 2 + 106, w: BUTTON_W, h: BUTTON_H },
    ];
  }
  return [];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 0;
  let viewH = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * ratio);
    canvas.height = Math.round(viewH * ratio);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(world, view) {
    const { left, top, right, bottom } = view;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(left, top, right - left, bottom - top);
    // Sidewalks: pale strips along every road.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const c of roadCenters()) {
      ctx.fillRect(left, c - 44, right - left, 88);
      ctx.fillRect(c - 44, top, 88, bottom - top);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const c of roadCenters()) {
      ctx.fillRect(left, c - 32, right - left, 64);
      ctx.fillRect(c - 32, top, 64, bottom - top);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const c of roadCenters()) {
      for (let x = Math.floor(left / 48) * 48; x < right; x += 48) ctx.fillRect(x, c - 2, 24, 4);
      for (let y = Math.floor(top / 48) * 48; y < bottom; y += 48) ctx.fillRect(c - 2, y, 4, 24);
    }
    // Parks and parking lots.
    for (const park of world.city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const lot of world.city.lots) {
      ctx.fillStyle = '#3f434b';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    }
  }

  function drawBuildings(world, view) {
    const { left, top, right, bottom } = view;
    for (const b of world.city.buildings) {
      if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
      // A darker drop edge, for a hint of height.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // Roof details: vents and skylights.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      const cols = Math.max(1, Math.floor(b.w / 70));
      const rows = Math.max(1, Math.floor(b.h / 70));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 14 + i * 70, b.y + 14 + j * 70, 26, 18);
        }
      }
      if (b.label) {
        ctx.font = `700 13px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    for (const c of world.city.containers) {
      if (c.x + c.w < left || c.x > right || c.y + c.h < top || c.y > bottom) continue;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    }
    for (const t of world.city.trees) {
      if (t.x < left - 20 || t.x > right + 20 || t.y < top - 20 || t.y > bottom + 20) continue;
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(world) {
    const m = world.marker;
    if (!m) return;
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 62, 0.12)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // A diamond pin over the spot.
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.mission;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function drawCar(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#15181c';
    ctx.fillRect(-16, -12, 10, 4);
    ctx.fillRect(-16, 8, 10, 4);
    ctx.fillRect(8, -12, 10, 4);
    ctx.fillRect(8, 8, 10, 4);
    // Body.
    ctx.fillStyle = car.color;
    roundRectPath(ctx, -23, -11, 46, 22, 6);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20, 28, 38, 0.85)';
    roundRectPath(ctx, -9, -9, 20, 18, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 210, 235, 0.7)';
    ctx.fillRect(9, -8, 3, 16);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(21, -8, 3, 4);
    ctx.fillRect(21, 4, 3, 4);
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#15181c';
      ctx.fillRect(-4, -11, 8, 22);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-2, -13, 6, 4);
    }
    if (car.kind === 'cop') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-6, -11, 12, 22);
      const flash = Math.floor(time * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7de1';
      ctx.fillRect(-2, -13, 5, 4);
      ctx.fillStyle = flash ? '#2f7de1' : '#ff3b30';
      ctx.fillRect(4, -13, 5, 4);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, down, isPlayer, aimAngle, hurt) {
    if (down) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = '#6b6f75';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick, and the gun line for the player.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
    ctx.stroke();
    if (isPlayer) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(aimAngle) * 8, Math.sin(aimAngle) * 8);
      ctx.lineTo(Math.cos(aimAngle) * 22, Math.sin(aimAngle) * 22);
      ctx.stroke();
      if (hurt) {
        ctx.strokeStyle = 'rgba(229,83,75,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawWorld(world, view) {
    drawGround(world, view);
    drawBuildings(world, view);
    drawMarker(world);
    // Cash bags.
    for (const spot of world.mission.spots) {
      if (spot.taken) continue;
      ctx.fillStyle = '#7ab648';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2f5a1e';
      ctx.lineWidth = 2;
      ctx.stroke();
      text('$', spot.x, spot.y + 5, 14, '#ffffff', 'center', '700');
    }
    for (const car of world.cars) drawCar(car, car.driver === 'player', world.time);
    for (const ped of world.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.state === 'down', false, 0, false);
    }
    for (const cop of world.police.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#2c4a7a', false, false, 0, false);
      // Cap.
      ctx.fillStyle = '#1d3250';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 2, 6, Math.PI, 0);
      ctx.fill();
    }
    for (const guard of world.mission.guards) {
      if (guard.state === 'down') {
        drawPerson(guard.x, guard.y, guard.angle, '#5a2d2d', true, false, 0, false);
      } else {
        drawPerson(guard.x, guard.y, guard.angle, '#5a2d2d', false, false, 0, false);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8);
        ctx.lineTo(guard.x + Math.cos(guard.angle) * 22, guard.y + Math.sin(guard.angle) * 22);
        ctx.stroke();
      }
    }
    const p = world.player;
    if (!p.inCar) {
      drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, false, true, p.aimAngle, p.hurtCooldown > 0);
    }
    // Bullets as short tracers.
    ctx.lineWidth = 2;
    for (const b of world.bullets) {
      ctx.strokeStyle = b.from === 'player' ? '#ffd23e' : '#ff8a6a';
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    world.particles.draw(ctx);
  }

  function drawButton(button, hover) {
    ctx.fillStyle = hover ? '#f2c230' : 'rgba(255,255,255,0.92)';
    roundRectPath(ctx, button.x, button.y, button.w, button.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    text(button.label, button.x + button.w / 2, button.y + 33, 19, '#14181f', 'center', '700');
  }

  function drawPanel(w, h, title, lines, prompt) {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.panel;
    const pw = 560;
    const ph = 150 + lines.length * 30;
    roundRectPath(ctx, w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    text(title, w / 2, h / 2 - ph / 2 + 58, 40, PALETTE.text, 'center', '700');
    lines.forEach((line, i) => {
      text(line, w / 2, h / 2 - ph / 2 + 100 + i * 30, 16, PALETTE.muted, 'center');
    });
    if (prompt) text(prompt, w / 2, h / 2 + ph / 2 - 22, 15, PALETTE.gold, 'center');
  }

  function drawTitle(world, w, h, mouse, saveExists) {
    const zoom = world.camera.zoom;
    const vw = w / zoom;
    const vh = h / zoom;
    const view = {
      left: world.camera.x - vw / 2,
      top: world.camera.y - vh / 2,
      right: world.camera.x + vw / 2,
      bottom: world.camera.y + vh / 2,
    };
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-world.camera.x, -world.camera.y);
    drawWorld(world, view);
    ctx.restore();
    ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
    ctx.fillRect(0, 0, w, h);
    text('VISTAMAR', w / 2, h / 2 - 130, 84, PALETTE.gold, 'center', '800');
    text('An open-world crime story', w / 2, h / 2 - 92, 20, PALETTE.text, 'center');
    text('Steal cars. Outrun the law. Finish Delia’s four jobs.', w / 2, h / 2 - 62, 15, PALETTE.muted, 'center');
    const buttons = screenButtons(SCREEN_TITLE, w, h, saveExists);
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(b, hover);
    }
    text('WASD / arrows — move & drive · Mouse — aim · Click — shoot · E — enter car · Q — next job · P — pause · M — mute', w / 2, h - 26, 13, PALETTE.muted, 'center');
    text('A work of fiction. Any resemblance to real people, places or games is coincidence.', w / 2, h - 8, 11, 'rgba(255,255,255,0.35)', 'center');
  }

  function draw(world, screen, mouse, saveExists, overKind) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, viewW, viewH);
    const zoom = world.camera.zoom;
    const vw = viewW / zoom;
    const vh = viewH / zoom;
    const view = {
      left: world.camera.x - vw / 2,
      top: world.camera.y - vh / 2,
      right: world.camera.x + vw / 2,
      bottom: world.camera.y + vh / 2,
    };
    if (screen === SCREEN_TITLE) {
      drawTitle(world, viewW, viewH, mouse, saveExists);
      return screenButtons(SCREEN_TITLE, viewW, viewH, saveExists);
    }
    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-world.camera.x, -world.camera.y);
    drawWorld(world, view);
    ctx.restore();
    if (screen === SCREEN_PLAY) {
      drawHud(ctx, world, viewW, viewH);
      drawBanner(ctx, world, viewW, viewH);
      return [];
    }
    if (screen === SCREEN_PAUSED) {
      drawHud(ctx, world, viewW, viewH);
      const buttons = screenButtons(SCREEN_PAUSED, viewW, viewH, saveExists);
      drawPanel(viewW, viewH, 'Paused', ['The city waits for you.'], '');
      for (const b of buttons) {
        const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
        drawButton(b, hover);
      }
      return buttons;
    }
    // Game over.
    drawHud(ctx, world, viewW, viewH);
    const buttons = screenButtons(SCREEN_OVER, viewW, viewH, saveExists);
    const title = overKind === 'wasted' ? 'WASTED' : 'BUSTED';
    const lines = overKind === 'wasted'
      ? ['Jax got taken down.', 'The hospital patched him up — for a fee.']
      : ['The Vistamar police caught up with Jax.', 'Bail and impound fees apply.'];
    drawPanel(viewW, viewH, title, lines, '');
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(b, hover);
    }
    return buttons;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
