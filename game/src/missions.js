// Neon Bay — the story: six jobs for Rex Vega, from a first pickup to
// owning the city. Each mission is a list of stages; a stage is a goto, a
// steal, a kill, or a survive. The engine below starts stages, watches
// for them to finish, pays out, and moves on to the next job.

import { GANG } from './config.js';
import { makeGang } from './entities.js';
import { hasLineOfSight, collidesSolid } from './world.js';
import { addHeat } from './police.js';

// Landmarks are named, not numbered: the mission data reads like the
// story, and the engine resolves each name against the world.
export const MISSIONS = [
  {
    name: 'The Pickup',
    brief: 'A client left a package across town. Drive to the marker and pick it up.',
    reward: 400,
    stages: [{ type: 'goto', at: 'east', r: 70, label: 'Drive to the yellow marker' }],
  },
  {
    name: "Mama Rosa's Errand",
    brief: "Mama Rosa needs medicine from the south side, then a drop at the safehouse.",
    reward: 600,
    stages: [
      { type: 'goto', at: 'south', r: 70, label: 'Pick up the medicine' },
      { type: 'goto', at: 'safehouse', r: 80, label: 'Drop it at the safehouse' },
    ],
  },
  {
    name: "The Don's Favour",
    brief: 'The Don wants a fresh car. Take one — any one — and deliver it to the dockyard.',
    reward: 900,
    stages: [
      { type: 'steal', label: 'Steal a car' },
      { type: 'goto', at: 'dockyard', r: 90, label: 'Deliver the car to the dockyard' },
    ],
  },
  {
    name: 'Park War',
    brief: 'The Vipers took the park. Clear all six of them out.',
    reward: 1200,
    stages: [
      { type: 'goto', at: 'park', r: 120, label: 'Get to Marina Park' },
      { type: 'kill', n: 6, at: 'park', r: 280, label: 'Take out the Vipers' },
    ],
  },
  {
    name: 'Getaway',
    brief: 'The whole city is after you. Stay free for 45 seconds, then vanish at the safehouse.',
    reward: 1800,
    stages: [
      { type: 'survive', seconds: 45, label: 'Lose the cops — stay free' },
      { type: 'goto', at: 'safehouse', r: 80, label: 'Reach the safehouse' },
    ],
  },
  {
    name: 'Take the City',
    brief: 'One last job: the Viper boss is in the park. End him, then come home.',
    reward: 3000,
    stages: [
      { type: 'goto', at: 'park', r: 120, label: 'Get to Marina Park' },
      { type: 'kill', n: 1, boss: true, at: 'park', r: 280, label: 'Take out the boss' },
      { type: 'goto', at: 'safehouse', r: 80, label: 'Come home' },
    ],
  },
];

export function createMissionState() {
  return { idx: 0, stage: 0, timer: 0, done: false, started: false };
}

function landmark(S, name) {
  const w = S.world;
  switch (name) {
    case 'park':
      return w.parkCenter;
    case 'dockyard':
      return { x: w.dockyard.x + w.dockyard.w / 2, y: w.dockyard.y + w.dockyard.h / 2 };
    case 'safehouse':
      return w.safehouse;
    case 'east':
      return { x: 2700, y: 750 };
    case 'south':
      return { x: 900, y: 1750 };
    default:
      return w.spawn;
  }
}

function spawnGang(S, stage) {
  const c = landmark(S, stage.at);
  for (let n = 0; n < stage.n; n++) {
    let x = c.x;
    let y = c.y;
    for (let tries = 0; tries < 12; tries++) {
      const a = S.rng.float(0, Math.PI * 2);
      const r = S.rng.float(40, stage.r || 240);
      x = c.x + Math.cos(a) * r;
      y = c.y + Math.sin(a) * r;
      if (!collidesSolid(S.world, x, y, 16)) break;
    }
    const g = makeGang(x, y);
    if (stage.boss) {
      g.hp = 300;
      g.maxHp = 300;
      g.boss = true;
    }
    S.gang.push(g);
  }
}

function startStage(S) {
  const m = MISSIONS[S.mission.idx];
  const stage = m.stages[S.mission.stage];
  if (!stage) return;
  S.mission.timer = stage.seconds || 0;
  if (stage.type === 'kill') spawnGang(S, stage);
  if (stage.type === 'survive') {
    S.heat = Math.max(S.heat, 74);
    S.wanted = 3;
    S.lastCrimeT = S.now;
    S.feed.push({ text: 'Three stars — the whole city is after you!', t: S.now });
  }
  S.feed.push({ text: `${m.name}: ${stage.label}`, t: S.now });
}

export function startMission(S) {
  const m = MISSIONS[S.mission.idx];
  if (!m) {
    S.mission.done = true;
    return;
  }
  S.mission.stage = 0;
  S.mission.started = true;
  S.feed.push({ text: `New job: ${m.name} — $${m.reward}`, t: S.now });
  startStage(S);
}

// Jump straight to one stage of one mission (used by staged screenshots).
export function jumpToStage(S, idx, stage) {
  S.mission.idx = idx;
  S.mission.stage = stage;
  S.mission.started = true;
  S.mission.done = false;
  startStage(S);
}

function completeMission(S) {
  const m = MISSIONS[S.mission.idx];
  S.player.cash += m.reward;
  S.stats.missionsDone++;
  S.feed.push({ text: `Job done: ${m.name} — +$${m.reward}`, t: S.now });
  S.audio.cash();
  S.mission.idx++;
  if (S.mission.idx >= MISSIONS.length) {
    S.mission.done = true;
    S.feed.push({ text: 'You own Neon Bay now. Free roam.', t: S.now });
  } else {
    startMission(S);
  }
}

export function updateMissions(S, dt) {
  if (S.mission.done) return;
  if (!S.mission.started) {
    startMission(S);
    return;
  }
  const m = MISSIONS[S.mission.idx];
  const stage = m.stages[S.mission.stage];
  if (!stage) return;

  let finished = false;
  if (stage.type === 'goto') {
    const p = landmark(S, stage.at);
    if (Math.hypot(S.player.x - p.x, S.player.y - p.y) < stage.r) finished = true;
  } else if (stage.type === 'steal') {
    if (S.player.inCar) finished = true;
  } else if (stage.type === 'kill') {
    if (S.gang.length === 0) finished = true;
  } else if (stage.type === 'survive') {
    S.heat = Math.max(S.heat, 55); // keep the heat on for the whole chase
    S.mission.timer -= dt;
    if (S.mission.timer <= 0) finished = true;
  }

  if (!finished) return;
  S.mission.stage++;
  if (S.mission.stage >= m.stages.length) completeMission(S);
  else startStage(S);
}

// The current objective, for the HUD and the minimap. A kill stage points
// at the park; a survive stage has no marker, only a countdown.
export function missionMarker(S) {
  if (S.mission.done || !S.mission.started) return null;
  const m = MISSIONS[S.mission.idx];
  const stage = m.stages[S.mission.stage];
  if (!stage) return null;
  if (stage.type === 'goto') {
    const p = landmark(S, stage.at);
    return { x: p.x, y: p.y, label: stage.label };
  }
  if (stage.type === 'kill') {
    const p = landmark(S, stage.at);
    return { x: p.x, y: p.y, label: `${stage.label} (${S.gang.length} left)` };
  }
  if (stage.type === 'steal') return { label: stage.label };
  if (stage.type === 'survive') return { label: `${stage.label} — ${Math.ceil(S.mission.timer)}s` };
  return null;
}

// Gang members guard their turf: they hold position, and shoot the player
// on sight — only when they can actually see them, and only once the
// player has come onto their turf, opened fire, or hurt one of them.
// That gives the player a beat to size up the park instead of eating a
// volley the moment the job starts.
export function updateGang(S, dt) {
  const pc = S.world.parkCenter;
  const turfDist = Math.hypot(S.player.x - pc.x, S.player.y - pc.y);
  const provoked = S.now - (S.lastPlayerShotT || -99) < 3;
  for (const g of S.gang) {
    const dx = S.player.x - g.x;
    const dy = S.player.y - g.y;
    const dist = Math.hypot(dx, dy);
    g.angle = Math.atan2(dy, dx);
    g.shootCd -= dt;
    const engaged = turfDist < 300 || provoked || g.aggro;
    if (engaged && dist < GANG.shootRange && g.shootCd <= 0) {
      if (hasLineOfSight(S.world, g.x, g.y, S.player.x, S.player.y)) {
        g.shootCd = GANG.shootRate * (g.boss ? 0.7 : 1);
        const a = g.angle + (S.rng.next() - 0.5) * 0.2;
        S.bullets.push({
          x: g.x + Math.cos(a) * 20,
          y: g.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 620,
          vy: Math.sin(a) * 620,
          life: 1,
          dmg: g.boss ? 12 : GANG.damage,
          from: 'gang',
        });
        S.audio.enemyShoot();
      }
    }
  }
}
