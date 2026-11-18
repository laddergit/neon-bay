// Neon Bay — staged scenes for screenshots. A ?shot= URL puts the game
// straight into a moment worth showing (title, driving, a police chase, a
// mission firefight) and the game keeps running from there, so traffic
// moves and the scene reads as alive instead of posed.

import { makeCar } from './entities.js';
import { jumpToStage } from './missions.js';
import { POLICE } from './config.js';

export function getShotParams() {
  const q = new URLSearchParams(window.location.search);
  const seed = q.get('seed');
  return { shot: q.get('shot'), seed: seed === null ? null : Number(seed) };
}

// Put the player in a car on a long straight road, already moving.
function putPlayerInCar(S, x, y, angle, speed) {
  const car = makeCar(x, y, angle, '#d94f3d', 'player');
  car.speed = speed;
  S.cars.push(car);
  S.player.inCar = car;
  S.player.x = x;
  S.player.y = y;
  S.player.angle = angle;
}

export function applyShot(S, shot) {
  S.shot = shot;
  if (!shot) return;

  if (shot === 'start') {
    // Title screen over the living city; the camera drifts downtown.
    S.mode = 'title';
    S.camera.x = 1500 - S.view.w / 2;
    S.camera.y = 1250 - S.view.h / 2;
    return;
  }

  S.mode = 'playing';
  if (shot === 'drive') {
    // Downtown, in traffic, doing 45 mph.
    putPlayerInCar(S, 900, 1250, 0, 380);
    S.autoDrive = true;
    S.feed.push({ text: 'Neon Bay — downtown', t: S.now });
  } else if (shot === 'chase') {
    // Three stars, three patrol cars already closing in. The car starts
    // on the same road as the first mission's marker, heading straight
    // for it, so the chase runs fast down a long road instead of getting
    // tangled in a turn, and the heat starts high enough to stay at
    // three stars for the shot.
    putPlayerInCar(S, 900, 750, 0, 420);
    S.autoDrive = true;
    S.heat = 68;
    S.wanted = 3;
    S.lastCrimeT = S.now;
    // Three patrol cars already on the player's tail, close enough to be
    // in frame: the wanted system counts them and spawns no more.
    for (const [dx, dy] of [[-260, -30], [-380, 50], [-500, -60]]) {
      const pc = makeCar(900 + dx, 750 + dy, 0, '#20242e', 'police');
      pc.cruise = POLICE.carSpeed;
      pc.speed = 430;
      S.cars.push(pc);
    }
    S.feed.push({ text: 'Three stars — lose them!', t: S.now });
  } else if (shot === 'mission') {
    // Park War in progress: six Vipers in Marina Park, Rex on foot at
    // the park's edge, pistol ready. He stands just outside their turf,
    // so the standoff holds for the shot instead of a volley.
    jumpToStage(S, 3, 1);
    S.player.x = S.world.parkCenter.x - 320;
    S.player.y = S.world.parkCenter.y + 60;
    S.player.hp = 100;
    S.player.ammo = 12;
    S.player.reserve = 48;
  }
}
