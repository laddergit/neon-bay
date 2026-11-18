// Neon Bay — one factory per thing that moves. Every car, pedestrian,
// bullet, pickup, gang member and cop is a plain object; the systems in
// traffic.js, police.js and player.js give them behaviour.

import { CAR } from './config.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b93c', '#7a4fd0', '#3fae6a', '#e8e4da', '#22242a', '#d97b2f'];
export const PED_COLORS = ['#e8e4da', '#3d7dd9', '#e8b93c', '#d94f3d', '#7a4fd0', '#3fae6a', '#c25e7a'];

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    speed: 0,
    color,
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    hp: CAR.hp,
    maxHp: CAR.hp,
    // traffic routing (waypoint grid indices)
    fromI: 0, fromJ: 0, toI: 0, toJ: 0,
    tx: x, ty: y,
    cruise: 150,
    stuckT: 0,
    ramCd: 0,
    brake: false,
  };
}

export function makePed(x, y, color) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    color,
    state: 'walk', // 'walk' | 'flee' | 'idle'
    tx: x, ty: y,
    waitT: 0,
    panic: 0,
    speed: 0,
  };
}

export function makeBullet(x, y, angle, speed, dmg, from) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.1,
    dmg,
    from, // 'player' | 'gang' | 'cop'
  };
}

export function makePickup(x, y, kind, amount) {
  return { x, y, kind, amount, bob: Math.random() * Math.PI * 2 };
}

export function makeGang(x, y) {
  // A beat before the first shot: the player gets a moment to react when
  // a firefight starts, instead of eating a volley on the same frame.
  return { x, y, hp: 100, angle: 0, shootCd: 2.5 + Math.random() * 1.5, state: 'guard' };
}

export function makeCop(x, y) {
  return { x, y, hp: 100, angle: 0, shootCd: 1, bustT: 0 };
}
