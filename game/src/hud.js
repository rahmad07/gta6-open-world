// The HUD: everything drawn in screen space over the city — cash and
// health, the wanted stars, the current objective, the minimap, the speed,
// and the edge arrow that points at an off-screen objective. All of it is
// plain canvas shapes and text; nothing here knows about the game loop.
import { PALETTE, FONT } from './config.js';

const MAP_SIZE = 190;
const MAP_PAD = 14;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, value, x, y, size, color, align = 'left', weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function drawStars(ctx, wanted, x, y, flash) {
  for (let i = 0; i < 5; i += 1) {
    const filled = i < wanted;
    const alpha = filled && flash ? (Math.floor(performance.now() / 300) % 2 === 0 ? 1 : 0.45) : 1;
    ctx.globalAlpha = alpha;
    ctx.font = `26px ${FONT}`;
    ctx.fillStyle = filled ? PALETTE.star : 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.fillText('★', x + i * 30, y);
    ctx.globalAlpha = 1;
  }
}

function drawMinimap(ctx, world, w, h) {
  const size = world.city.size;
  const scale = MAP_SIZE / size;
  const x0 = w - MAP_SIZE - MAP_PAD;
  const y0 = h - MAP_SIZE - MAP_PAD;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.85)';
  roundRect(ctx, x0 - 6, y0 - 6, MAP_SIZE + 12, MAP_SIZE + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x0, y0, MAP_SIZE, MAP_SIZE, 6);
  ctx.clip();
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
  // Parks.
  ctx.fillStyle = '#2f6b2f';
  for (const park of world.city.parks) ctx.fillRect(x0 + park.x * scale, y0 + park.y * scale, park.w * scale, park.h * scale);
  // Roads.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = Math.max(2, 64 * scale);
  ctx.beginPath();
  for (const c of [32, 356, 680, 1004, 1328, 1652, 1976, 2300, 2624]) {
    ctx.moveTo(x0 + c * scale, y0);
    ctx.lineTo(x0 + c * scale, y0 + MAP_SIZE);
    ctx.moveTo(x0, y0 + c * scale);
    ctx.lineTo(x0 + MAP_SIZE, y0 + c * scale);
  }
  ctx.stroke();
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Cash bags, mission marker, traffic, police, player.
  for (const spot of world.mission.spots) {
    if (!spot.taken) dot(spot.x, spot.y, 3, '#7ab648');
  }
  for (const car of world.cars) {
    if (car.driver === 'police') dot(car.x, car.y, 3.5, '#4f8fd0');
    else if (car.driver === 'player') continue;
    else dot(car.x, car.y, 2, 'rgba(255,255,255,0.65)');
  }
  for (const cop of world.police.cops) dot(cop.x, cop.y, 3, '#4f8fd0');
  if (world.marker) {
    const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
    dot(world.marker.x, world.marker.y, pulse, PALETTE.mission);
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + world.marker.x * scale, y0 + world.marker.y * scale, pulse + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The player: a yellow arrow pointing where he faces.
  const p = world.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'VISTAMAR', x0, y0 + MAP_SIZE + 16, 11, PALETTE.muted, 'left', '700');
}

function drawEdgeArrow(ctx, world, w, h) {
  const marker = world.marker;
  if (!marker) return;
  const cam = world.camera;
  const zoom = cam.zoom;
  const viewW = w / zoom;
  const viewH = h / zoom;
  const left = cam.x - viewW / 2;
  const top = cam.y - viewH / 2;
  const mx = marker.x;
  const my = marker.y;
  if (mx > left + 60 && mx < left + viewW - 60 && my > top + 60 && my < top + viewH - 60) return;
  // Clamp the marker to the screen edge and point at it.
  const sx = Math.max(40, Math.min(w - 40, ((mx - left) / viewW) * w));
  const sy = Math.max(40, Math.min(h - 40, ((my - top) / viewH) * h));
  const angle = Math.atan2(my - (top + (sy / h) * viewH), mx - (left + (sx / w) * viewW));
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.mission;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const dist = Math.round(Math.hypot(world.player.x - mx, world.player.y - my));
  text(ctx, `${dist}m`, sx, sy + 30, 13, PALETTE.mission, 'center', '700');
}

export function drawHud(ctx, world, w, h) {
  const p = world.player;
  // Top-left: cash and health.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.65)';
  roundRect(ctx, 12, 12, 210, 64, 10);
  ctx.fill();
  text(ctx, `$${p.cash.toLocaleString('en-US')}`, 26, 40, 24, PALETTE.gold, 'left', '700');
  const hw = 182;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 26, 50, hw, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#7ab648' : '#e5534b';
  roundRect(ctx, 26, 50, Math.max(12, hw * (p.health / 100)), 12, 6);
  ctx.fill();

  // Top-right: wanted stars.
  drawStars(ctx, world.wanted, w - 150, 44, world.wanted > 0);
  if (world.wanted > 0) text(ctx, 'WANTED', w - 26, 66, 12, PALETTE.danger, 'right', '700');

  // Top-centre: the current objective.
  const obj = world.currentObjective();
  if (obj) {
    const label = `${obj.mission} — ${obj.text}`;
    ctx.font = `700 15px ${FONT}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.65)';
    roundRect(ctx, w / 2 - tw / 2 - 14, 12, tw + 28, 34, 10);
    ctx.fill();
    text(ctx, label, w / 2, 35, 15, PALETTE.text, 'center', '700');
    if (obj.timer !== null && obj.timer !== undefined) {
      const t = Math.max(0, Math.ceil(obj.timer));
      text(ctx, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w / 2, 66, 20, t < 30 ? PALETTE.danger : PALETTE.gold, 'center', '700');
    }
  } else if (world.completedMissions.length < 4) {
    text(ctx, 'Press Q for the next job', w / 2, 34, 14, PALETTE.muted, 'center');
  }

  // Toast under the objective.
  if (world.toast) {
    ctx.font = `15px ${FONT}`;
    const tw = ctx.measureText(world.toast.text).width;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.7)';
    roundRect(ctx, w / 2 - tw / 2 - 12, 54, tw + 24, 30, 8);
    ctx.fill();
    text(ctx, world.toast.text, w / 2, 74, 15, PALETTE.gold, 'center');
  }

  // Bottom-left: speed and car, or the on-foot hint.
  if (p.inCar) {
    const kind = p.inCar.kind;
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    text(ctx, `${kmh} km/h`, 26, h - 40, 26, PALETTE.text, 'left', '700');
    text(ctx, kind === 'cop' ? 'Patrol car' : `${kind[0].toUpperCase()}${kind.slice(1)} — E to get out`, 26, h - 16, 13, PALETTE.muted, 'left');
  } else {
    text(ctx, 'WASD move · Shift run · E enter car · Click to shoot', 26, h - 16, 13, PALETTE.muted, 'left');
  }

  drawEdgeArrow(ctx, world, w, h);
  drawMinimap(ctx, world, w, h);
}

export function drawBanner(ctx, world, w, h) {
  const banner = world.banner;
  if (!banner) return;
  const fade = Math.min(1, (banner.until - world.time) / 0.8);
  ctx.globalAlpha = Math.max(0, fade);
  ctx.font = `700 34px ${FONT}`;
  const titleW = ctx.measureText(banner.title).width;
  ctx.font = `15px ${FONT}`;
  const subW = ctx.measureText(banner.sub).width;
  const bw = Math.max(titleW, subW) + 56;
  const bh = 108;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, w / 2 - bw / 2, 84, bw, bh, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, banner.title, w / 2, 126, 34, PALETTE.gold, 'center', '700');
  // Wrap the brief to the panel width.
  const words = banner.sub.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    ctx.font = `15px ${FONT}`;
    if (ctx.measureText(test).width > bw - 60 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => {
    text(ctx, l, w / 2, 156 + i * 20, 15, PALETTE.text, 'center');
  });
  ctx.globalAlpha = 1;
}
