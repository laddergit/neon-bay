// Neon Bay — the HUD (health, cash, wanted stars, clock, objective, ammo,
// speed, message feed, minimap) and the menu screens (title, help, pause,
// busted, wasted). Everything draws on the same canvas, in screen space,
// after the world render.

import { WORLD, MINIMAP, PLAYER } from './config.js';
import { missionMarker } from './missions.js';

function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = '#ffe14d';
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function clockText(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawMinimap(S) {
  const ctx = S.ctx;
  const size = MINIMAP;
  const x0 = S.view.w - size - 14;
  const y0 = S.view.h - size - 14;
  const sx = size / WORLD.w;
  const sy = size / WORLD.h;
  panel(ctx, x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#20242e';
  ctx.fillRect(x0, y0, size, size);
  // Sea.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0, y0 + S.world.seaY * sy, size, size - S.world.seaY * sy);
  // Roads.
  ctx.fillStyle = '#555049';
  for (const x of S.world.roadsV) ctx.fillRect(x0 + x * sx - 2, y0, 4, size);
  for (const y of S.world.roadsH) ctx.fillRect(x0, y0 + y * sy - 2, size, 4);
  // Parks.
  ctx.fillStyle = '#5d9b4a';
  for (const park of S.world.parks) {
    ctx.fillRect(x0 + park.x * sx, y0 + park.y * sy, Math.max(2, park.w * sx), Math.max(2, park.h * sy));
  }
  // Mission marker.
  const m = S.marker;
  if (m && m.x !== undefined) {
    const pulse = 5 + Math.sin(S.now * 5) * 2;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(x0 + m.x * sx, y0 + m.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gang.
  ctx.fillStyle = '#ff4d4d';
  for (const g of S.gang) {
    ctx.beginPath();
    ctx.arc(x0 + g.x * sx, y0 + g.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#4da3ff';
  for (const car of S.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player.
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(x0 + S.player.x * sx, y0 + S.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawHUD(S) {
  const ctx = S.ctx;
  const P = S.player;

  // Top left: health and cash.
  panel(ctx, 12, 12, 230, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(P.hp)}`, 24, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 42, 206, 12);
  ctx.fillStyle = P.hp > 50 ? '#37d67a' : P.hp > 25 ? '#e8c85a' : '#e84d4d';
  ctx.fillRect(24, 42, Math.max(0, 206 * (P.hp / PLAYER.hp)), 12);
  ctx.fillStyle = '#37f2a2';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`$${P.cash}`, 24, 70);

  // Top right: wanted stars and the clock.
  panel(ctx, S.view.w - 218, 12, 206, 64);
  for (let i = 0; i < 5; i++) {
    star(ctx, S.view.w - 196 + i * 30, 36, 11, i < S.wanted);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(clockText(S.clockMin), S.view.w - 24, 68);
  ctx.textAlign = 'left';

  // Top centre: the current objective.
  const m = S.marker;
  if (m) {
    ctx.font = 'bold 16px sans-serif';
    const label = m.label || '';
    const w = ctx.measureText(label).width + 28;
    panel(ctx, (S.view.w - w) / 2, 12, w, 40);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(label, S.view.w / 2, 38);
    ctx.textAlign = 'left';
  }

  // Bottom left: weapon, ammo, speed.
  panel(ctx, 12, S.view.h - 64, 210, 52);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  const ammoText = P.reloadT > 0 ? 'RELOADING…' : `PISTOL ${P.ammo} / ${P.reserve}`;
  ctx.fillText(ammoText, 24, S.view.h - 40);
  if (P.inCar) {
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(`${Math.round(Math.abs(P.inCar.speed) * 0.12)} mph`, 24, S.view.h - 20);
  } else {
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('E steal car · F punch · R reload', 24, S.view.h - 20);
  }

  // Message feed, fading out.
  ctx.font = '15px sans-serif';
  let fy = 92;
  for (let i = S.feed.length - 1; i >= 0; i--) {
    const msg = S.feed[i];
    const age = S.now - msg.t;
    if (age > 6) continue;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - age / 6)})`;
    ctx.fillText(msg.text, 24, fy);
    fy += 22;
    if (fy > 220) break;
  }

  drawMinimap(S);
}

function menuButton(ctx, S, label, y, selected, action) {
  const w = 340;
  const h = 52;
  const x = (S.view.w - w) / 2;
  ctx.fillStyle = selected ? '#ffe14d' : 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = selected ? '#7a5b00' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = selected ? '#111' : '#fff';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, S.view.w / 2, y + 33);
  ctx.textAlign = 'left';
  S.menuButtons.push({ x, y, w, h, action });
}

export function drawTitle(S) {
  const ctx = S.ctx;
  S.menuButtons = [];
  ctx.fillStyle = 'rgba(8,10,18,0.62)';
  ctx.fillRect(0, 0, S.view.w, S.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('NEON BAY', S.view.w / 2, S.view.h * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME STORY', S.view.w / 2, S.view.h * 0.3 + 36);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText('Rex Vega came home to Neon Bay with nothing but a busted car and a name', S.view.w / 2, S.view.h * 0.3 + 78);
  ctx.fillText('people still remember. Six jobs stand between him and the whole city.', S.view.w / 2, S.view.h * 0.3 + 102);
  ctx.textAlign = 'left';

  const buttons = ['NEW GAME'];
  if (S.saveExists) buttons.push('CONTINUE');
  buttons.push('HOW TO PLAY');
  let y = S.view.h * 0.3 + 140;
  buttons.forEach((label, i) => {
    menuButton(ctx, S, label, y, S.menuSel === i, label);
    y += 66;
  });
  S.menuLabels = buttons;
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move · mouse aim · click shoot · E steal car · P pause · M mute', S.view.w / 2, S.view.h - 28);
  ctx.textAlign = 'left';
}

export function drawHelp(S) {
  const ctx = S.ctx;
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.fillRect(0, 0, S.view.w, S.view.h);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', S.view.w / 2, 110);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  const lines = [
    'WASD / arrows — move on foot, drive the car',
    'Mouse — aim · Left click / Space — shoot',
    'E — steal / exit a car · F — punch · R — reload',
    'Shift — sprint · P — pause · M — mute',
    '',
    'Steal cars, take jobs from the marker, earn cash.',
    'Crimes raise your wanted level — the cops will come.',
    'Lose them, lay low, and the heat cools off.',
    'Finish all six jobs to own Neon Bay.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, S.view.w / 2, 160 + i * 32));
  ctx.fillStyle = '#888';
  ctx.font = '15px sans-serif';
  ctx.fillText('Click or press Esc to go back', S.view.w / 2, 160 + lines.length * 32 + 20);
  ctx.textAlign = 'left';
}

export function drawPause(S) {
  const ctx = S.ctx;
  ctx.fillStyle = 'rgba(8,10,18,0.66)';
  ctx.fillRect(0, 0, S.view.w, S.view.h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', S.view.w / 2, S.view.h / 2 - 40);
  ctx.font = '19px sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText('P — resume · S — save game · Q — quit to title', S.view.w / 2, S.view.h / 2 + 8);
  ctx.fillText(`Cash $${S.player.cash} · Jobs done ${S.stats.missionsDone} / 6 · Cars stolen ${S.stats.carsStolen}`, S.view.w / 2, S.view.h / 2 + 44);
  ctx.textAlign = 'left';
}

export function drawEnd(S, kind) {
  const ctx = S.ctx;
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.72)' : 'rgba(60,8,8,0.72)';
  ctx.fillRect(0, 0, S.view.w, S.view.h);
  ctx.fillStyle = kind === 'busted' ? '#7db4ff' : '#ff6b6b';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', S.view.w / 2, S.view.h / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '19px sans-serif';
  ctx.fillText(
    kind === 'busted' ? 'The cops got you. Bail is $200 — press Enter to walk free.' : 'You got wasted. Press Enter to wake up at the hospital.',
    S.view.w / 2,
    S.view.h / 2 + 16,
  );
  ctx.fillText(`Cash $${S.player.cash} · Jobs done ${S.stats.missionsDone} / 6`, S.view.w / 2, S.view.h / 2 + 48);
  ctx.textAlign = 'left';
}
