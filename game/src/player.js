// The player: Jax Moreno, on foot and behind the wheel. On foot he walks
// (Shift to run), aims with the mouse and fires with the left button; in a
// car the same keys drive. Entering a car is the world's job to arrange;
// this file moves the body, fires the gun and takes the hits.
import { CAR, PLAYER } from './config.js';
import { resolveCircle } from './city.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: PLAYER.health,
    cash: 0,
    inCar: null,
    fireCooldown: 0,
    hurtCooldown: 0,
    regenDelay: 0,
    moving: false,
    speed: 0,
  };
}

function pushFromCars(world, x, y, radius) {
  for (const car of world.cars) {
    if (car === world.player.inCar) continue;
    const dx = x - car.x;
    const dy = y - car.y;
    const d = Math.hypot(dx, dy);
    const min = radius + 18;
    if (d > 0.01 && d < min) {
      x = car.x + (dx / d) * min;
      y = car.y + (dy / d) * min;
    }
  }
  return { x, y };
}

export function updateOnFoot(world, dt, input, aimWorld) {
  const p = world.player;
  const mx = input.moveX();
  const my = input.moveY();
  const moving = mx !== 0 || my !== 0;
  p.moving = moving;
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.speed = speed;
    p.angle = Math.atan2(my, mx);
  } else {
    p.speed = 0;
  }
  // The player faces the mouse while aiming, the road while walking.
  if (aimWorld) p.aimAngle = Math.atan2(aimWorld.y - p.y, aimWorld.x - p.x);
  else p.aimAngle = p.angle;
  resolveCircle(world.city, p, PLAYER.radius);
  const pushed = pushFromCars(world, p.x, p.y, PLAYER.radius);
  p.x = pushed.x;
  p.y = pushed.y;

  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
  if (p.regenDelay > 0) {
    p.regenDelay -= dt;
  } else if (p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 4 * dt);
  }

  // Fire toward the mouse while the button is held.
  if (input.mouse().down && p.fireCooldown <= 0) {
    p.fireCooldown = PLAYER.fireRate;
    const a = p.aimAngle;
    world.bullets.push({
      x: p.x + Math.cos(a) * 18,
      y: p.y + Math.sin(a) * 18,
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: 0.9,
      damage: PLAYER.bulletDamage,
      from: 'player',
    });
    world.particles.muzzle(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a);
    world.audio.shot();
    world.addCrime(0, p.x, p.y); // firing a gun is noticed if anyone is near
    world.notifyGunshot(p.x, p.y);
  }
}

// Drive the car the player is sitting in: W/S for throttle and brake,
// A/D to steer (the wheel turns less the faster you go), with a little
// drift when you steer hard at speed.
export function driveCar(world, dt, input) {
  const car = world.player.inCar;
  if (!car) return;
  const kind = CAR.kinds[car.kind] || CAR.kinds.sedan;
  const throttle = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -0.6 : 0;
  const steer = input.moveX();
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) car.speed += CAR.brake * throttle * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.drag * 260 * dt);
  if (car.speed > kind.maxSpeed) car.speed = kind.maxSpeed;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  const steerAuthority = CAR.grip * Math.min(1, Math.abs(car.speed) / 140);
  car.angle += steer * steerAuthority * dt * Math.sign(car.speed || 1);
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.angle = car.angle;
  world.player.speed = Math.abs(car.speed);
  world.player.moving = Math.abs(car.speed) > 5;

  // Two-circle body: nose and tail each bounce off buildings. A hard hit
  // (fast, and not already touching) crashes and bounces; a car already
  // pressed against a wall just slides along it instead of having its
  // speed eaten every step, so it can always back out or turn away.
  let touching = false;
  for (const [off, r] of [[16, CAR.radius], [-16, CAR.radius]]) {
    const probe = { x: car.x + fx * off, y: car.y + fy * off };
    if (resolveCircle(world.city, probe, r)) {
      touching = true;
      const hitSpeed = Math.abs(car.speed);
      car.x += probe.x - (car.x + fx * off);
      car.y += probe.y - (car.y + fy * off);
      if (hitSpeed > 140 && !car.touching) {
        world.particles.crash(car.x + fx * off, car.y + fy * off);
        world.audio.crash(hitSpeed / 400);
        car.speed *= -0.25;
      }
    }
  }
  car.touching = touching;
  // Tire smoke when steering hard at speed.
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260 && world.rng.chance(0.4)) {
    world.particles.tireSmoke(car.x - fx * 18, car.y - fy * 18);
  }
  world.audio.setEngine(Math.abs(car.speed) / kind.maxSpeed, true);
}

export function enterCar(world, car) {
  const p = world.player;
  p.inCar = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  world.audio.engine(true);
}

export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  p.inCar = null;
  // Step out on the driver's side, clear of the body.
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 26;
  p.y = car.y + Math.sin(car.angle + side) * 26;
  p.speed = 0;
  resolveCircle(world.city, p, PLAYER.radius);
  world.audio.engine(false);
  world.audio.setEngine(0, false);
}

export function damagePlayer(world, amount) {
  const p = world.player;
  if (p.hurtCooldown > 0 || p.health <= 0) return;
  p.health -= amount;
  p.hurtCooldown = 0.25;
  p.regenDelay = 8;
  if (p.health <= 0) {
    p.health = 0;
    world.events.push('wasted');
  }
}

export function healPlayer(world, amount) {
  const p = world.player;
  p.health = Math.min(PLAYER.health, p.health + amount);
}
