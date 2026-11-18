// Neon Bay — traffic. Cars drive the road grid from intersection to
// intersection, keeping to the right-hand lane, turning at random, and
// braking for whatever is in front of them. Waypoints (not lane math) are
// what make the turns work: a car always steers at a real point on the
// road, so it can never miss an intersection.

import { TRAFFIC, LANE } from './config.js';
import { makeCar, CAR_COLORS } from './entities.js';
import { angleDiff, clamp } from './random.js';

function laneTarget(world, fromI, fromJ, toI, toJ) {
  const a = world.intersections[fromI][fromJ];
  const b = world.intersections[toI][toJ];
  // The target is the far intersection, shifted into the right-hand lane
  // for the direction of travel.
  if (toI > fromI) return { x: b.x, y: b.y + LANE }; // eastbound: right is south
  if (toI < fromI) return { x: b.x, y: b.y - LANE }; // westbound: right is north
  if (toJ > fromJ) return { x: b.x - LANE, y: b.y }; // southbound: right is west
  return { x: b.x + LANE, y: b.y }; // northbound: right is east
}

function pickNext(world, rng, i, j, fromI, fromJ) {
  const maxI = world.roadsV.length - 1;
  const maxJ = world.roadsH.length - 1;
  const options = [];
  if (i < maxI) options.push({ i: i + 1, j, w: i + 1 === fromI && j === fromJ ? 0.05 : 0.55 });
  if (i > 0) options.push({ i: i - 1, j, w: i - 1 === fromI && j === fromJ ? 0.05 : 0.55 });
  if (j < maxJ) options.push({ i, j: j + 1, w: i === fromI && j + 1 === fromJ ? 0.05 : 0.55 });
  if (j > 0) options.push({ i, j: j - 1, w: i === fromI && j - 1 === fromJ ? 0.05 : 0.55 });
  // Weight straight ahead heavily; the "back the way it came" option is
  // nearly never picked except at the edge of the grid.
  let total = 0;
  for (const o of options) total += o.w;
  let roll = rng.next() * total;
  for (const o of options) {
    roll -= o.w;
    if (roll <= 0) return o;
  }
  return options[0];
}

export function spawnTrafficCar(S, x, y) {
  const car = makeCar(x, y, 0, S.rng.pick(CAR_COLORS), 'traffic');
  car.cruise = TRAFFIC.speed + S.rng.float(-TRAFFIC.speedVar, TRAFFIC.speedVar);
  const n = S.world.intersections;
  const i = S.rng.int(0, n.length - 1);
  const j = S.rng.int(0, n[0].length - 1);
  const next = pickNext(S.world, S.rng, i, j, -1, -1);
  car.fromI = i;
  car.fromJ = j;
  car.toI = next.i;
  car.toJ = next.j;
  const t = laneTarget(S.world, i, j, next.i, next.j);
  car.tx = t.x;
  car.ty = t.y;
  const start = S.world.intersections[i][j];
  car.x = start.x;
  car.y = start.y;
  car.angle = Math.atan2(t.y - start.y, t.x - start.x);
  return car;
}

export function createTraffic(S, count) {
  for (let n = 0; n < count; n++) {
    S.cars.push(spawnTrafficCar(S));
  }
}

export function spawnParkedCars(S, count) {
  const spots = [];
  for (const lot of S.world.lots) {
    if (lot.kind !== 'lot') continue;
    for (let k = 0; k < 3; k++) {
      spots.push({
        x: lot.x + 30 + S.rng.float(0, Math.max(10, lot.w - 60)),
        y: lot.y + 30 + S.rng.float(0, Math.max(10, lot.h - 60)),
        angle: S.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      });
    }
  }
  for (let k = 0; k < count; k++) {
    const s = spots.length ? spots.splice(S.rng.int(0, spots.length - 1), 1)[0] : null;
    if (!s) break;
    S.cars.push(makeCar(s.x, s.y, s.angle, S.rng.pick(CAR_COLORS), 'parked'));
  }
}

function obstacleAhead(S, car, lookAhead) {
  const ax = car.x + Math.cos(car.angle) * lookAhead;
  const ay = car.y + Math.sin(car.angle) * lookAhead;
  for (const other of S.cars) {
    if (other === car || other.kind === 'traffic') continue;
    const dx = other.x - ax;
    const dy = other.y - ay;
    if (dx * dx + dy * dy < 48 * 48) return true;
  }
  return false;
}

export function updateTraffic(S, dt) {
  for (const car of S.cars) {
    if (car.kind !== 'traffic') continue;

    const dx = car.tx - car.x;
    const dy = car.ty - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      // Reached the intersection: pick the next leg.
      const next = pickNext(S.world, S.rng, car.toI, car.toJ, car.fromI, car.fromJ);
      car.fromI = car.toI;
      car.fromJ = car.toJ;
      car.toI = next.i;
      car.toJ = next.j;
      const t = laneTarget(S.world, car.fromI, car.fromJ, next.i, next.j);
      car.tx = t.x;
      car.ty = t.y;
      continue;
    }

    const want = Math.atan2(dy, dx);
    const turn = angleDiff(car.angle, want);
    car.angle += clamp(turn, -3.6 * dt, 3.6 * dt);

    // Slow for sharp turns and for anything stopped in front.
    let target = car.cruise;
    if (Math.abs(turn) > 0.7) target *= 0.45;
    if (obstacleAhead(S, car, 74)) target = 0;
    for (const other of S.cars) {
      if (other === car || other.kind !== 'traffic') continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 62 && side < 30) target = Math.min(target, other.speed);
    }
    car.speed += clamp(target - car.speed, -420 * dt, 300 * dt);
    if (car.speed < 1) car.speed = Math.max(0, car.speed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    if (car.speed < 4) {
      car.stuckT += dt;
      if (car.stuckT > 4) {
        const fresh = spawnTrafficCar(S);
        Object.assign(car, fresh);
        car.stuckT = 0;
      }
    } else {
      car.stuckT = 0;
    }
  }
}
