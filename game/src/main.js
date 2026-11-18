// Neon Bay — the entry point: builds the state, runs the loop, and owns
// the mode machine (title, help, playing, paused, busted, wasted).
// Everything else is a system this file calls in order.

import { WORLD, PLAYER, TRAFFIC, PEDS } from './config.js';
import { makeRng, clamp, lerp } from './random.js';
import { buildWorld, collidesSolid } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { makePed, PED_COLORS } from './entities.js';
import { createTraffic, spawnParkedCars, spawnTrafficCar, updateTraffic } from './traffic.js';
import { updatePolice, updateWanted } from './police.js';
import { updatePlayer, scatterPickups } from './player.js';
import { createMissionState, updateMissions, updateGang, missionMarker } from './missions.js';
import { render } from './render.js';
import { drawHUD, drawTitle, drawHelp, drawPause, drawEnd } from './hud.js';
import { saveGame, loadGame, saveExists } from './save.js';
import { getShotParams, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function spawnPeds(S, count) {
  for (let n = 0; n < count; n++) {
    let x = 0;
    let y = 0;
    if (S.rng.chance(0.3) && S.world.parks.length) {
      const park = S.rng.pick(S.world.parks);
      x = park.x + S.rng.float(20, park.w - 20);
      y = park.y + S.rng.float(20, park.h - 20);
    } else {
      const road = S.rng.chance(0.5)
        ? { x: S.rng.pick(S.world.roadsV), y: S.rng.float(80, S.world.beachY - 80) }
        : { x: S.rng.float(80, WORLD.w - 80), y: S.rng.pick(S.world.roadsH) };
      x = road.x + S.rng.float(-70, 70);
      y = road.y + S.rng.float(-70, 70);
    }
    if (collidesSolid(S.world, x, y, 12)) continue;
    S.peds.push(makePed(x, y, S.rng.pick(PED_COLORS)));
  }
}

function createState(seed) {
  const rng = makeRng(seed);
  const world = buildWorld(rng);
  const S = {
    seed,
    rng,
    world,
    ctx,
    now: 0,
    clockMin: 9 * 60,
    mode: 'title',
    view: { w: window.innerWidth, h: window.innerHeight },
    camera: { x: 0, y: 0 },
    player: {
      x: world.spawn.x,
      y: world.spawn.y,
      angle: 0,
      hp: PLAYER.hp,
      cash: 0,
      ammo: PLAYER.pistolMag,
      reserve: 48,
      inCar: null,
      shootCd: 0,
      punchCd: 0,
      reloadT: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    gang: [],
    cops: [],
    pickups: [],
    effects: [],
    wanted: 0,
    heat: 0,
    lastCrimeT: -100,
    alarm: null,
    mission: createMissionState(),
    feed: [],
    stats: { kills: 0, carsStolen: 0, missionsDone: 0 },
    input: createInput(canvas),
    audio: createAudio(),
    marker: null,
    menuSel: 0,
    menuButtons: [],
    menuLabels: [],
    shot: null,
    saveExists: saveExists(),
    trafficTimer: 0,
    lastMissionIdx: 0,
  };
  createTraffic(S, TRAFFIC.count);
  spawnParkedCars(S, 14);
  spawnPeds(S, PEDS.count);
  scatterPickups(S, rng);
  return S;
}

// Pedestrians stroll between the roads and the parks. A gunshot or an
// explosion nearby sends them running the other way.
function pickPedTarget(S, ped) {
  if (S.rng.chance(0.25) && S.world.parks.length) {
    const park = S.rng.pick(S.world.parks);
    ped.tx = park.x + S.rng.float(20, park.w - 20);
    ped.ty = park.y + S.rng.float(20, park.h - 20);
  } else {
    const road = S.rng.chance(0.5)
      ? { x: S.rng.pick(S.world.roadsV), y: S.rng.float(80, S.world.beachY - 80) }
      : { x: S.rng.float(80, WORLD.w - 80), y: S.rng.pick(S.world.roadsH) };
    ped.tx = road.x + S.rng.float(-70, 70);
    ped.ty = road.y + S.rng.float(-70, 70);
  }
}

function updatePeds(S, dt) {
  for (const ped of S.peds) {
    if (S.alarm && S.now - S.alarm.t < 2) {
      const d = Math.hypot(ped.x - S.alarm.x, ped.y - S.alarm.y);
      if (d < 340) {
        ped.state = 'flee';
        ped.panic = 2.5;
      }
    }
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const dx = ped.x - (S.alarm ? S.alarm.x : ped.x);
      const dy = ped.y - (S.alarm ? S.alarm.y : ped.y);
      const d = Math.hypot(dx, dy) || 1;
      ped.angle = Math.atan2(dy, dx);
      const nx = ped.x + Math.cos(ped.angle) * PEDS.flee * dt;
      const ny = ped.y + Math.sin(ped.angle) * PEDS.flee * dt;
      if (!collidesSolid(S.world, nx, ped.y, 9)) ped.x = nx;
      if (!collidesSolid(S.world, ped.x, ny, 9)) ped.y = ny;
      if (ped.panic <= 0) ped.state = 'walk';
      continue;
    }
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      ped.waitT -= dt;
      if (ped.waitT <= 0) {
        pickPedTarget(S, ped);
        ped.waitT = S.rng.float(1, 4);
      }
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(ped.angle) * PEDS.walk * dt;
    const ny = ped.y + Math.sin(ped.angle) * PEDS.walk * dt;
    if (!collidesSolid(S.world, nx, ped.y, 9)) ped.x = nx;
    if (!collidesSolid(S.world, ped.x, ny, 9)) ped.y = ny;
  }
}

function updateEffects(S, dt) {
  for (let i = S.effects.length - 1; i >= 0; i--) {
    S.effects[i].life -= dt;
    if (S.effects[i].life <= 0) S.effects.splice(i, 1);
  }
  if (S.feed.length > 8) S.feed.splice(0, S.feed.length - 8);
}

function followCamera(S, dt) {
  const tx = S.player.x - S.view.w / 2;
  const ty = S.player.y - S.view.h / 2;
  const maxX = Math.max(0, WORLD.w - S.view.w);
  const maxY = Math.max(0, WORLD.h - S.view.h);
  const cx = clamp(tx, 0, maxX);
  const cy = clamp(ty, 0, maxY);
  S.camera.x = lerp(S.camera.x, cx, 1 - Math.pow(0.001, dt));
  S.camera.y = lerp(S.camera.y, cy, 1 - Math.pow(0.001, dt));
}

function startGame(S, fromSave) {
  const save = fromSave ? loadGame() : null;
  S.player.hp = PLAYER.hp;
  S.player.ammo = PLAYER.pistolMag;
  S.player.reserve = 48;
  S.player.inCar = null;
  S.player.x = S.world.spawn.x;
  S.player.y = S.world.spawn.y;
  S.wanted = 0;
  S.heat = 0;
  S.cops.length = 0;
  S.gang.length = 0;
  S.bullets.length = 0;
  S.feed.length = 0;
  S.mission = createMissionState();
  S.stats = { kills: 0, carsStolen: 0, missionsDone: 0 };
  S.player.cash = 0;
  if (save) {
    S.player.cash = save.cash || 0;
    S.player.hp = save.hp || PLAYER.hp;
    S.player.ammo = save.ammo ?? PLAYER.pistolMag;
    S.player.reserve = save.reserve ?? 48;
    S.player.x = save.px ?? S.world.spawn.x;
    S.player.y = save.py ?? S.world.spawn.y;
    S.clockMin = save.clockMin || 9 * 60;
    S.stats = save.stats || S.stats;
    S.mission.idx = Math.min(save.missionIdx || 0, 5);
    S.mission.started = false; // the mission restarts from its first stage
    S.feed.push({ text: 'Welcome back to Neon Bay.', t: S.now });
  } else {
    S.feed.push({ text: 'Welcome to Neon Bay. Follow the yellow marker.', t: S.now });
  }
  S.mode = 'playing';
  S.audio.ensure();
}

function activateMenu(S) {
  const label = S.menuLabels[S.menuSel];
  S.audio.ensure();
  S.audio.click();
  if (label === 'NEW GAME') startGame(S, false);
  else if (label === 'CONTINUE') startGame(S, true);
  else if (label === 'HOW TO PLAY') S.mode = 'help';
}

function respawn(S) {
  S.player.cash = Math.max(0, S.player.cash - 200);
  S.player.hp = PLAYER.hp;
  S.player.inCar = null;
  S.player.x = S.mode === 'busted' ? S.world.safehouse.x : S.world.spawn.x;
  S.player.y = S.mode === 'busted' ? S.world.safehouse.y : S.world.spawn.y;
  S.wanted = 0;
  S.heat = 0;
  S.cops.length = 0;
  S.mode = 'playing';
  S.feed.push({ text: S.mode === 'playing' ? 'Back on the streets.' : '', t: S.now });
}

function resize(S) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    S.view.w = w;
    S.view.h = h;
  }
}

function update(S, dt) {
  resize(S);
  if (S.input.keys.size > 0 || S.input.mouse.clicked) S.audio.ensure();
  if (S.input.pressed('KeyM')) S.audio.setMuted(!S.audio.muted);

  if (S.mode === 'title') {
    S.now += dt;
    S.camera.x += 14 * dt;
    if (S.camera.x > WORLD.w - S.view.w) S.camera.x = 0;
    if (S.input.pressed('ArrowUp') || S.input.pressed('KeyW')) {
      if (S.menuLabels.length) S.menuSel = (S.menuSel + S.menuLabels.length - 1) % S.menuLabels.length;
    }
    if (S.input.pressed('ArrowDown') || S.input.pressed('KeyS')) {
      if (S.menuLabels.length) S.menuSel = (S.menuSel + 1) % S.menuLabels.length;
    }
    if (S.input.pressed('Enter') || S.input.pressed('Space')) activateMenu(S);
    if (S.input.mouse.clicked) {
      for (const b of S.menuButtons) {
        if (
          S.input.mouse.clickedX >= b.x &&
          S.input.mouse.clickedX <= b.x + b.w &&
          S.input.mouse.clickedY >= b.y &&
          S.input.mouse.clickedY <= b.y + b.h
        ) {
          S.menuSel = S.menuLabels.indexOf(b.action);
          activateMenu(S);
          break;
        }
      }
    }
    return;
  }

  if (S.mode === 'help') {
    if (S.input.pressed('Escape') || S.input.mouse.clicked) S.mode = 'title';
    return;
  }

  if (S.mode === 'paused') {
    if (S.input.pressed('KeyP') || S.input.pressed('Escape') || S.input.pressed('Enter')) {
      S.mode = 'playing';
    } else if (S.input.pressed('KeyS')) {
      if (saveGame(S)) {
        S.feed.push({ text: 'Progress saved.', t: S.now });
        S.saveExists = true;
      }
    } else if (S.input.pressed('KeyQ')) {
      S.mode = 'title';
      S.menuSel = 0;
    }
    return;
  }

  if (S.mode === 'busted' || S.mode === 'wasted') {
    if (S.input.pressed('Enter')) respawn(S);
    return;
  }

  // Playing.
  S.now += dt;
  S.clockMin += dt * (60 / 90);
  S.marker = missionMarker(S);
  updatePlayer(S, dt);
  updateTraffic(S, dt);
  updatePolice(S, dt);
  updateWanted(S, dt);
  updateGang(S, dt);
  updateMissions(S, dt);
  updatePeds(S, dt);
  updateEffects(S, dt);
  followCamera(S, dt);

  // Keep the streets full: replace traffic that was wrecked.
  const trafficCount = S.cars.filter((c) => c.kind === 'traffic').length;
  if (trafficCount < TRAFFIC.count) {
    S.trafficTimer -= dt;
    if (S.trafficTimer <= 0) {
      S.trafficTimer = 3;
      S.cars.push(spawnTrafficCar(S));
    }
  }

  // Autosave when a job is finished.
  if (S.stats.missionsDone > S.lastMissionIdx) {
    S.lastMissionIdx = S.stats.missionsDone;
    saveGame(S);
    S.saveExists = true;
  }

  S.audio.setSiren(S.wanted > 0, S.now);
  S.audio.setEngine(S.player.inCar ? Math.abs(S.player.inCar.speed) / 560 : 0);
  S.audio.musicTick(S.now);

  if (S.input.pressed('KeyP') || S.input.pressed('Escape')) S.mode = 'paused';
}

function draw(S) {
  render(S);
  if (S.mode === 'playing' || S.mode === 'paused') drawHUD(S);
  if (S.mode === 'title') drawTitle(S);
  if (S.mode === 'help') drawHelp(S);
  if (S.mode === 'paused') drawPause(S);
  if (S.mode === 'busted' || S.mode === 'wasted') drawEnd(S, S.mode);
}

function boot() {
  const params = getShotParams();
  const save = loadGame();
  const seed = params.seed || (save && save.seed) || 1337;
  const S = createState(seed);
  resize(S);
  // Debug handle for automated playtests (read-only inspection from CDP).
  window.__neonBay = S;
  applyShot(S, params.shot);
  if (S.mode === 'title') {
    // Centre the title camera downtown.
    S.camera.x = clamp(1500 - S.view.w / 2, 0, Math.max(0, WORLD.w - S.view.w));
    S.camera.y = clamp(1250 - S.view.h / 2, 0, Math.max(0, WORLD.h - S.view.h));
  }
  let last = performance.now();
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    try {
      update(S, dt);
      draw(S);
    } catch (e) {
      // Never let one bad frame kill the game; the console still shows it.
      console.error(e);
    }
    S.input.endFrame();
  }
  requestAnimationFrame(frame);
}

boot();
