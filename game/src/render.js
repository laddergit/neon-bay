// Neon Bay — everything the player sees, drawn on one canvas. The world
// is drawn in layers (ground, roads, parks, buildings, cars, people,
// effects) with the camera translated to the player's view. Only what is
// on screen gets drawn.

import { WORLD, ROAD_W, PALETTE, MINIMAP } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function inView(S, x, y, pad) {
  return (
    x > S.camera.x - pad &&
    x < S.camera.x + S.view.w + pad &&
    y > S.camera.y - pad &&
    y < S.camera.y + S.view.h + pad
  );
}

function drawCarShape(ctx, car, now) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -20, -9, 44, 22, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -11, 44, 22, 7);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -6, -9, 14, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.fillRect(8, -9, 6, 18);
  // Headlights.
  ctx.fillStyle = '#ffe9a3';
  ctx.fillRect(20, -8, 3, 4);
  ctx.fillRect(20, 5, 3, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-2, -11, 8, 22);
    // Light bar, alternating red and blue.
    const phase = Math.floor(now * 3) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e7bff';
    ctx.beginPath();
    ctx.arc(-4, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase ? '#2e7bff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(-4, 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.kind === 'player') {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2;
    roundRect(ctx, -22, -11, 44, 22, 7);
    ctx.stroke();
  }
  // Damage smoke puff.
  if (car.hp < 45) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath();
    ctx.arc(-14, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, S) {
  const w = S.world;
  const cam = S.camera;
  const vw = S.view.w;
  const vh = S.view.h;

  // Ground.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(cam.x, cam.y, vw, vh);

  // Beach and sea along the bottom edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(cam.x, Math.max(w.beachY, cam.y), vw, Math.max(0, Math.min(vh, w.seaY - Math.max(w.beachY, cam.y))));
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(cam.x, Math.max(w.seaY, cam.y), vw, vh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cam.x, w.seaY);
  ctx.lineTo(cam.x + vw, w.seaY);
  ctx.stroke();

  // Road beds.
  ctx.fillStyle = PALETTE.road;
  for (const x of w.roadsV) ctx.fillRect(x - ROAD_W / 2, cam.y, ROAD_W, vh);
  for (const y of w.roadsH) ctx.fillRect(cam.x, y - ROAD_W / 2, vw, ROAD_W);

  // Lane dashes.
  ctx.fillStyle = PALETTE.laneMark;
  for (const x of w.roadsV) {
    for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + vh; y += 48) {
      if (Math.abs(y - Math.round(y / 48) * 48) < 1) ctx.fillRect(x - 2, y, 4, 22);
    }
  }
  for (const y of w.roadsH) {
    for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + vw; x += 48) {
      ctx.fillRect(x, y - 2, 22, 4);
    }
  }

  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const x of w.roadsV) {
    for (const y of w.roadsH) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x - 26 + i * 11, y - ROAD_W / 2 + 8, 6, 16);
        ctx.fillRect(x - 26 + i * 11, y + ROAD_W / 2 - 24, 6, 16);
        ctx.fillRect(x - ROAD_W / 2 + 8, y - 26 + i * 11, 16, 6);
        ctx.fillRect(x + ROAD_W / 2 - 24, y - 26 + i * 11, 16, 6);
      }
    }
  }

  // Parks: green, a path, and trees.
  for (const park of w.parks) {
    if (!inView(S, park.cx, park.cy, Math.max(park.w, park.h))) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = PALETTE.parkPath;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(park.x, park.cy);
    ctx.lineTo(park.x + park.w, park.cy);
    ctx.moveTo(park.cx, park.y);
    ctx.lineTo(park.cx, park.y + park.h);
    ctx.stroke();
    ctx.fillStyle = '#3f7d33';
    const trees = 6;
    for (let i = 0; i < trees; i++) {
      const tx = park.x + 30 + ((i * 97) % Math.max(40, park.w - 60));
      const ty = park.y + 30 + ((i * 61) % Math.max(40, park.h - 60));
      ctx.beginPath();
      ctx.arc(tx, ty, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Parking lots and the dockyard.
  for (const lot of w.lots) {
    if (!inView(S, lot.x + lot.w / 2, lot.y + lot.h / 2, Math.max(lot.w, lot.h))) continue;
    ctx.fillStyle = PALETTE.lot;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    if (lot.kind === 'lot') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 40; x < lot.x + lot.w - 20; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 12);
        ctx.lineTo(x, lot.y + 42);
        ctx.stroke();
      }
    } else {
      for (const c of lot.containers) {
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(c.x, c.y, c.w, 10);
      }
    }
  }

  // Buildings, with a darker roof edge and the odd neon sign.
  for (const b of w.buildings) {
    if (!inView(S, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.roof;
    ctx.fillRect(b.x, b.y, b.w, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.fillRect(b.x + b.w / 2 - 22, b.y + b.h / 2 - 5, 44, 10);
    }
    if (b.safehouse) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SAFEHOUSE', b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
}

function drawMarker(ctx, S) {
  const m = S.marker;
  if (!m || m.x === undefined) return;
  const pulse = 1 + Math.sin(S.now * 5) * 0.15;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffe14d';
  ctx.fillRect(-13 * pulse, -13 * pulse, 26 * pulse, 26 * pulse);
  ctx.strokeStyle = '#7a5b00';
  ctx.lineWidth = 3;
  ctx.strokeRect(-13 * pulse, -13 * pulse, 26 * pulse, 26 * pulse);
  ctx.restore();
  // A beacon column so the marker reads from far away.
  ctx.fillStyle = 'rgba(255,225,77,0.16)';
  ctx.fillRect(m.x - 3, m.y - 260, 6, 260);
}

export function render(S) {
  const ctx = S.ctx;
  const now = S.now;
  ctx.clearRect(0, 0, S.view.w, S.view.h);
  ctx.save();
  ctx.translate(-S.camera.x, -S.camera.y);
  drawWorld(ctx, S);
  drawMarker(ctx, S);

  for (const pk of S.pickups) {
    if (!inView(S, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(pk.bob) * 3;
    ctx.fillStyle = pk.kind === 'health' ? '#ff5a5a' : pk.kind === 'ammo' ? '#e8c85a' : '#37f2a2';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + bob + 4);
  }

  for (const car of S.cars) {
    if (inView(S, car.x, car.y, 60)) drawCarShape(ctx, car, now);
  }

  for (const ped of S.peds) {
    if (!inView(S, ped.x, ped.y, 30)) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const g of S.gang) {
    if (!inView(S, g.x, g.y, 40)) continue;
    ctx.fillStyle = g.boss ? '#8b1a1a' : '#a83232';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.boss ? 17 : 13, 0, Math.PI * 2);
    ctx.fill();
    if (g.boss) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * 20, g.y + Math.sin(g.angle) * 20);
    ctx.stroke();
  }

  for (const cop of S.cops) {
    if (!inView(S, cop.x, cop.y, 40)) continue;
    ctx.fillStyle = '#1e3a6e';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9db8e8';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player, on foot: a figure with a gun barrel showing the aim.
  const P = S.player;
  if (!P.inCar && inView(S, P.x, P.y, 40)) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 6, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#19b8a6';
    ctx.beginPath();
    ctx.arc(P.x, P.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b5f56';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x + Math.cos(P.angle) * 24, P.y + Math.sin(P.angle) * 24);
    ctx.stroke();
  }

  for (const b of S.bullets) {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const e of S.effects) {
    const t = 1 - e.life / e.maxLife;
    if (e.type === 'explosion') {
      ctx.fillStyle = `rgba(255,${Math.floor(140 - 100 * t)},20,${0.9 - t * 0.6})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12 + t * 46, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'smoke') {
      ctx.fillStyle = `rgba(120,120,120,${0.5 - t * 0.4})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y - t * 20, 8 + t * 22, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'blood') {
      ctx.fillStyle = `rgba(140,10,10,${0.8 - t * 0.5})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6 + t * 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'spark') {
      ctx.fillStyle = '#fff2a8';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'muzzle') {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
