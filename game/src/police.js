// Neon Bay — the wanted system and the police. Heat rises with crimes and
// cools off when the player lies low; stars decide how many patrol cars
// and foot cops come after them. Patrol cars chase and ram, foot cops
// chase on foot, shoot, and bust the player if they get close enough.

import { POLICE, HEAT, WANTED_LEVELS, CAR } from './config.js';
import { makeCar, makeCop } from './entities.js';
import { angleDiff, clamp } from './random.js';
import { hasLineOfSight, randomRoadPoint, collidesSolid } from './world.js';

export function wantedFromHeat(heat) {
  let w = 0;
  for (let i = 0; i < WANTED_LEVELS.length; i++) {
    if (heat >= WANTED_LEVELS[i]) w = i;
  }
  return w;
}

export function addHeat(S, amount) {
  S.heat = clamp(S.heat + amount, 0, 100);
  S.wanted = wantedFromHeat(S.heat);
  S.lastCrimeT = S.now;
}

export function updateWanted(S, dt) {
  if (S.now - S.lastCrimeT > HEAT.grace) {
    S.heat = Math.max(0, S.heat - HEAT.decay * dt);
    const w = wantedFromHeat(S.heat);
    if (w !== S.wanted) S.wanted = w;
  }
}

function playerPos(S) {
  if (S.player.inCar) return { x: S.player.inCar.x, y: S.player.inCar.y };
  return { x: S.player.x, y: S.player.y };
}

function spawnPoliceCar(S) {
  // A road point a few hundred pixels from the player: close enough to
  // arrive fast, far enough not to pop in on screen.
  let p = randomRoadPoint(S.world, S.rng);
  for (let tries = 0; tries < 8; tries++) {
    const d = Math.hypot(p.x - S.player.x, p.y - S.player.y);
    if (d > 520 && d < 1000) break;
    p = randomRoadPoint(S.world, S.rng);
  }
  const car = makeCar(p.x, p.y, 0, '#20242e', 'police');
  car.cruise = POLICE.carSpeed;
  S.cars.push(car);
  return car;
}

function moveWithCollision(S, car, nx, ny, rad) {
  if (!collidesSolid(S.world, nx, car.y, rad)) car.x = nx;
  if (!collidesSolid(S.world, car.x, ny, rad)) car.y = ny;
}

export function updatePolice(S, dt) {
  const p = playerPos(S);

  // Heat gone: the whole force stands down at once, so no patrol car
  // keeps chasing a player the game no longer wants.
  if (S.wanted === 0) {
    for (let i = S.cars.length - 1; i >= 0; i--) {
      if (S.cars[i].kind === 'police') S.cars.splice(i, 1);
    }
    S.cops.length = 0;
  }

  const policeCars = S.cars.filter((c) => c.kind === 'police');

  // Bring the force up to the wanted level.
  const wantCars = Math.min(POLICE.maxCars, S.wanted);
  const wantCops = S.wanted >= 3 ? Math.min(POLICE.maxCops, S.wanted - 2) : 0;
  if (policeCars.length < wantCars && S.wanted > 0) {
    spawnPoliceCar(S);
  }
  while (S.cops.length > wantCops) S.cops.pop();

  for (const car of policeCars) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    const turn = angleDiff(car.angle, want);
    car.angle += clamp(turn, -3.2 * dt, 3.2 * dt);

    // A patrol car that has caught up rams; one that is far away hurries.
    let target = POLICE.carSpeed;
    if (dist < 130) target = POLICE.carSpeed * 0.55;
    car.speed += clamp(target - car.speed, -700 * dt, 520 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    moveWithCollision(S, car, nx, ny, CAR.radius);

    // Ram the player's car on contact, with a cooldown so one hit does
    // not shred it in a single frame.
    car.ramCd -= dt;
    if (S.player.inCar && dist < 52 && car.ramCd <= 0) {
      car.ramCd = CAR.ramCooldown;
      const pc = S.player.inCar;
      pc.hp -= CAR.ramDamage;
      S.effects.push({ x: pc.x, y: pc.y, life: 0.4, maxLife: 0.4, type: 'spark' });
      S.audio.punch();
      if (pc.hp <= 0) {
        S.effects.push({ x: pc.x, y: pc.y, life: 1, maxLife: 1, type: 'explosion' });
        S.audio.explosion();
        S.alarm = { x: pc.x, y: pc.y, t: S.now };
        S.player.inCar = null;
        S.player.x = pc.x + 30;
        S.player.y = pc.y + 30;
        S.cars.splice(S.cars.indexOf(pc), 1);
        S.feed.push({ text: 'Your car is wrecked!', t: S.now });
      }
    }

    // Close enough on foot: a cop gets out and gives chase.
    if (!S.player.inCar && dist < 170 && S.cops.length < wantCops) {
      S.cops.push(makeCop(car.x + 26, car.y + 26));
    }
  }

  // Keep patrol cars from piling onto one spot.
  for (let i = 0; i < policeCars.length; i++) {
    for (let j = i + 1; j < policeCars.length; j++) {
      const a = policeCars[i];
      const b = policeCars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 56) {
        const push = (56 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Foot cops: run the player down, shoot from range, bust up close.
  for (const cop of S.cops) {
    const dx = S.player.x - cop.x;
    const dy = S.player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (S.player.inCar) {
      // The player drove off: the cop gives up and heads back to the car.
      cop.bustT = 0;
      continue;
    }
    if (dist > 34) {
      const nx = cop.x + Math.cos(cop.angle) * POLICE.copSpeed * dt;
      const ny = cop.y + Math.sin(cop.angle) * POLICE.copSpeed * dt;
      if (!collidesSolid(S.world, nx, cop.y, 10)) cop.x = nx;
      if (!collidesSolid(S.world, cop.x, ny, 10)) cop.y = ny;
    }
    cop.shootCd -= dt;
    if (dist < POLICE.copShootRange && dist > 60 && cop.shootCd <= 0) {
      if (hasLineOfSight(S.world, cop.x, cop.y, S.player.x, S.player.y)) {
        cop.shootCd = POLICE.copShootRate;
        const a = cop.angle + (S.rng.next() - 0.5) * 0.16;
        S.bullets.push({
          x: cop.x + Math.cos(a) * 20,
          y: cop.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 700,
          vy: Math.sin(a) * 700,
          life: 1,
          dmg: POLICE.copDamage,
          from: 'cop',
        });
        S.audio.enemyShoot();
      }
    }
    if (dist < POLICE.bustRadius) {
      cop.bustT += dt;
      if (cop.bustT > POLICE.bustTime) {
        S.mode = 'busted';
        S.audio.busted();
      }
    } else {
      cop.bustT = Math.max(0, cop.bustT - dt * 2);
    }
  }
}
