// Short-lived visual effects: muzzle flashes, crash sparks, tire smoke,
// pickup sparkles, bloodless hit puffs and explosion debris. A fixed pool
// (no allocation while playing) with a spawn helper per effect.
export function createParticles() {
  const pool = [];
  for (let i = 0; i < 240; i += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0, drag: 1 });
  }

  function spawn(x, y, vx, vy, life, size, color, gravity = 0, drag = 0.98) {
    for (const p of pool) {
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      p.gravity = gravity;
      p.drag = drag;
      return;
    }
  }

  function burst(x, y, count, speed, life, size, color, gravity = 0) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size, color, gravity);
    }
  }

  return {
    muzzle(x, y, angle) {
      for (let i = 0; i < 5; i += 1) {
        const a = angle + (Math.random() - 0.5) * 0.7;
        const s = 260 + Math.random() * 220;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.12, 3, '#ffd23e');
      }
    },
    sparks(x, y) {
      burst(x, y, 10, 220, 0.35, 2.5, '#ffd23e', 300);
    },
    crash(x, y) {
      burst(x, y, 14, 180, 0.5, 3, '#c8c8c8', 200);
      burst(x, y, 6, 90, 0.7, 4, '#e5534b', 100);
    },
    smoke(x, y) {
      spawn(x, y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20 - 12, 0.8, 7, 'rgba(200,200,200,0.5)');
    },
    tireSmoke(x, y) {
      spawn(x, y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.5, 6, 'rgba(160,160,160,0.45)');
    },
    sparkle(x, y) {
      burst(x, y, 12, 120, 0.6, 3, '#ffd23e');
    },
    explosion(x, y) {
      burst(x, y, 26, 320, 0.8, 5, '#ff8a3c', 260);
      burst(x, y, 18, 200, 1.0, 7, '#5a5a5a', 60);
      burst(x, y, 10, 420, 0.4, 3, '#ffd23e', 300);
    },
    update(dt) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    draw(ctx) {
      for (const p of pool) {
        if (!p.active) continue;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}
