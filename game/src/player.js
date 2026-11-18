// Neon Bay — the player: walking, sprinting, aiming, shooting, punching,
// stealing cars and driving them. Bullets and pickups live here too,
// because they are the player's doing more than anyone else's.

import { PLAYER, CAR, HEAT, PICKUP } from './config.js';
import { makeBullet } from './entities.js';
import { collidesSolid } from './world.js';
import { addHeat } from './police.js';
import { clamp } from './random.js';

function aimAngle(S) {
  const wx = S.input.mouse.x + S.camera.x;
  const wy = S.input.mouse.y + S.camera.y;
  return Math.atan2(wy - S.player.y, wx - S.player.x);
}

function tryShoot(S) {
  const P = S.player;
  if (P.shootCd > 0 || P.ammo <= 0) return;
  P.shootCd = PLAYER.pistolRate;
  P.ammo--;
  const a = aimAngle(S);
  S.bullets.push(makeBullet(P.x + Math.cos(a) * 20, P.y + Math.sin(a) * 20, a, PLAYER.bulletSpeed, PLAYER.pistolDamage, 'player'));
  S.effects.push({ x: P.x + Math.cos(a) * 22, y: P.y + Math.sin(a) * 22, life: 0.08, maxLife: 0.08, type: 'muzzle' });
  S.audio.shoot();
  S.alarm = { x: P.x, y: P.y, t: S.now }; // nearby pedestrians hear the shot
  S.lastPlayerShotT = S.now; // gunfire provokes the gang into returning it
  addHeat(S, HEAT.shoot);
  if (P.ammo === 0) P.reloadT = 0.9;
}

function tryPunch(S) {
  const P = S.player;
  if (P.punchCd > 0) return;
  P.punchCd = PLAYER.punchRate;
  S.audio.punch();
  const a = P.angle;
  const hx = P.x + Math.cos(a) * 30;
  const hy = P.y + Math.sin(a) * 30;
  const hit = (t, r) => Math.hypot(t.x - hx, t.y - hy) < r;
  for (const g of S.gang) {
    if (hit(g, 34)) hurtGang(S, g, PLAYER.punchDamage);
  }
  for (const c of S.cops) {
    if (hit(c, 34)) hurtCop(S, c, PLAYER.punchDamage);
  }
  for (let i = S.peds.length - 1; i >= 0; i--) {
    if (hit(S.peds[i], 30)) killPed(S, i, 'punched');
  }
}

export function hurtGang(S, g, dmg) {
  g.hp -= dmg;
  g.aggro = true; // shooting a Viper makes the whole park return fire
  S.effects.push({ x: g.x, y: g.y, life: 0.3, maxLife: 0.3, type: 'blood' });
  if (g.hp <= 0) {
    S.gang.splice(S.gang.indexOf(g), 1);
    S.stats.kills++;
    if (S.rng.chance(0.5)) {
      S.pickups.push({ x: g.x, y: g.y, kind: 'health', amount: PICKUP.health, bob: 0 });
    }
  }
}

export function hurtCop(S, c, dmg) {
  c.hp -= dmg;
  S.effects.push({ x: c.x, y: c.y, life: 0.3, maxLife: 0.3, type: 'blood' });
  if (c.hp <= 0) {
    S.cops.splice(S.cops.indexOf(c), 1);
    S.stats.kills++;
    addHeat(S, HEAT.killCop);
  }
}

export function killPed(S, i, how) {
  const ped = S.peds[i];
  S.peds.splice(i, 1);
  S.effects.push({ x: ped.x, y: ped.y, life: 0.4, maxLife: 0.4, type: 'blood' });
  addHeat(S, HEAT.killPed);
  S.feed.push({ text: `Pedestrian ${how} — the cops noticed.`, t: S.now });
}

function tryEnterExitCar(S) {
  const P = S.player;
  if (P.inCar) {
    const car = P.inCar;
    P.inCar = null;
    car.kind = 'parked';
    car.speed = 0;
    // Step out on the driver's side.
    P.x = car.x - Math.sin(car.angle) * 34;
    P.y = car.y + Math.cos(car.angle) * 34;
    return;
  }
  let best = null;
  let bestD = 78;
  for (const car of S.cars) {
    const d = Math.hypot(car.x - P.x, car.y - P.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  P.inCar = best;
  best.kind = 'player';
  P.angle = best.angle;
  S.stats.carsStolen++;
  addHeat(S, HEAT.steal);
  S.feed.push({ text: 'You stole a car!', t: S.now });
  S.audio.click();
}

function updateOnFoot(S, dt) {
  const P = S.player;
  const axis = S.input.moveAxis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const speed = (S.input.sprint() ? PLAYER.sprint : PLAYER.walk) * (axis.x || axis.y ? 1 : 0);
  const vx = (axis.x / len) * speed;
  const vy = (axis.y / len) * speed;
  const nx = P.x + vx * dt;
  const ny = P.y + vy * dt;
  if (!collidesSolid(S.world, nx, P.y, PLAYER.radius)) P.x = nx;
  if (!collidesSolid(S.world, P.x, ny, PLAYER.radius)) P.y = ny;
  P.angle = aimAngle(S);

  if (S.input.mouse.down || S.input.down('Space')) tryShoot(S);
  if (S.input.pressed('KeyF')) tryPunch(S);
  if (S.input.pressed('KeyR')) reload(S);
  if (P.reloadT > 0) {
    P.reloadT -= dt;
    if (P.reloadT <= 0) reload(S);
  }
  if (S.input.pressed('KeyE')) tryEnterExitCar(S);
}

function reload(S) {
  const P = S.player;
  const need = PLAYER.pistolMag - P.ammo;
  if (need <= 0 || P.reserve <= 0) return;
  const take = Math.min(need, P.reserve);
  P.ammo += take;
  P.reserve -= take;
  S.audio.click();
}

function updateDriving(S, dt) {
  const P = S.player;
  const car = P.inCar;
  const input = S.input;
  const up = input.down('KeyW') || input.down('ArrowUp') || S.autoDrive; // staged shots drive themselves
  const down = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');

  if (up) car.speed += CAR.accel * dt;
  if (down) {
    car.speed += car.speed > 12 ? -CAR.brake * dt : -CAR.reverseAccel * dt;
  }
  // Rolling drag.
  car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const steerScale = clamp(Math.abs(car.speed) / 150, 0, 1);
  car.angle += steer * CAR.steer * steerScale * dt * Math.sign(car.speed || 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!collidesSolid(S.world, nx, car.y, CAR.radius)) car.x = nx;
  else car.speed *= -0.25;
  if (!collidesSolid(S.world, car.x, ny, CAR.radius)) car.y = ny;
  else car.speed *= -0.25;

  P.x = car.x;
  P.y = car.y;
  P.angle = car.angle;

  // Shunt other cars aside, and mind the pedestrians. Bumping into a car
  // ahead caps the player's speed to it (like real traffic) instead of
  // stopping them dead, and the scrape only wears the other car down
  // slowly, so a nudge does not total it.
  for (const other of S.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 44) {
      const push = (44 - d) / 2;
      const px = dx / d;
      const py = dy / d;
      other.x += px * push;
      other.y += py * push;
      if (car.speed > other.speed) car.speed = Math.max(other.speed, 160);
      if (other.kind === 'traffic' || other.kind === 'parked') {
        other.hp -= 6 * dt;
        if (other.hp <= 0) wreckCar(S, other);
      }
    }
  }
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (Math.abs(car.speed) > 60 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
      killPed(S, i, 'run over');
    }
  }

  // Smoke from a dying engine.
  if (car.hp < 45 && S.rng.chance(dt * 6)) {
    S.effects.push({ x: car.x, y: car.y, life: 0.8, maxLife: 0.8, type: 'smoke' });
  }
  if (S.input.pressed('KeyE')) tryEnterExitCar(S);
}

export function wreckCar(S, car) {
  S.effects.push({ x: car.x, y: car.y, life: 1, maxLife: 1, type: 'explosion' });
  S.audio.explosion();
  S.alarm = { x: car.x, y: car.y, t: S.now }; // the blast scares pedestrians off
  if (S.player.inCar === car) {
    S.player.inCar = null;
    S.player.x = car.x + 34;
    S.player.y = car.y + 34;
  }
  S.cars.splice(S.cars.indexOf(car), 1);
}

function updateBullets(S, dt) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && collidesSolid(S.world, b.x, b.y, 2)) {
      S.effects.push({ x: b.x, y: b.y, life: 0.15, maxLife: 0.15, type: 'spark' });
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const g of [...S.gang]) {
        if (Math.hypot(g.x - b.x, g.y - b.y) < 16) {
          hurtGang(S, g, b.dmg);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const c of [...S.cops]) {
          if (Math.hypot(c.x - b.x, c.y - b.y) < 16) {
            hurtCop(S, c, b.dmg);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let k = S.peds.length - 1; k >= 0; k--) {
          if (Math.hypot(S.peds[k].x - b.x, S.peds[k].y - b.y) < 14) {
            killPed(S, k, 'shot');
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of [...S.cars]) {
          if (car.kind === 'player') continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
            car.hp -= b.dmg;
            if (car.hp <= 0) {
              if (car.kind === 'police') addHeat(S, HEAT.killCop);
              wreckCar(S, car);
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'gang' || b.from === 'cop')) {
      if (S.player.inCar) {
        const car = S.player.inCar;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          car.hp -= b.dmg;
          if (car.hp <= 0) wreckCar(S, car);
          dead = true;
        }
      } else if (Math.hypot(S.player.x - b.x, S.player.y - b.y) < 14) {
        S.player.hp -= b.dmg;
        dead = true;
        if (S.player.hp <= 0) {
          S.player.hp = 0;
          S.mode = 'wasted';
        }
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}

function updatePickups(S, dt) {
  const P = S.player;
  if (P.inCar) return;
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    pk.bob += dt * 4;
    if (Math.hypot(pk.x - P.x, pk.y - P.y) < 28) {
      if (pk.kind === 'health') P.hp = Math.min(PLAYER.hp, P.hp + pk.amount);
      if (pk.kind === 'ammo') P.reserve += pk.amount;
      if (pk.kind === 'cash') {
        P.cash += pk.amount;
        S.audio.cash();
      } else {
        S.audio.pickup();
      }
      S.pickups.splice(i, 1);
    }
  }
}

export function updatePlayer(S, dt) {
  const P = S.player;
  P.shootCd -= dt;
  P.punchCd -= dt;
  if (P.inCar) updateDriving(S, dt);
  else updateOnFoot(S, dt);
  updateBullets(S, dt);
  updatePickups(S, dt);
}

export function scatterPickups(S, rng) {
  const spots = [];
  for (let i = 0; i < 10; i++) {
    const x = rng.float(150, 3450);
    const y = rng.float(150, 2350);
    if (!collidesSolid(S.world, x, y, 20)) spots.push({ x, y });
  }
  spots.forEach((s, i) => {
    const kind = i % 3 === 0 ? 'cash' : i % 3 === 1 ? 'health' : 'ammo';
    const amount = kind === 'cash' ? 150 : kind === 'health' ? PICKUP.health : PICKUP.ammo;
    S.pickups.push({ x: s.x, y: s.y, kind, amount, bob: 0 });
  });
}
