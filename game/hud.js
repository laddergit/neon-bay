'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var messages = [];
  var buttons = [];

  function message(text, dur) {
    messages.push({ text: text, t: dur || 3.5, max: dur || 3.5 });
    if (messages.length > 3) messages.shift();
  }

  function update(dt) {
    for (var i = messages.length - 1; i >= 0; i--) {
      messages[i].t -= dt;
      if (messages[i].t <= 0) messages.splice(i, 1);
    }
  }

  function button(ctx, id, label, x, y, w, h) {
    ctx.fillStyle = '#1d2a4a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    buttons.push({ id: id, x: x, y: y, w: w, h: h });
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(8,8,18,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  function drawMinimap(ctx, x, y, size) {
    var s = size / NB.City.WORLD;
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,20,0.85)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    // water
    ctx.fillStyle = '#0b2a4a';
    ctx.fillRect(x, y + NB.City.WATER_Y * s, size, size - NB.City.WATER_Y * s);
    // park
    ctx.fillStyle = '#1d4028';
    ctx.fillRect(x + 1440 * s, y + 1800 * s, 320 * s, 320 * s);
    // roads
    ctx.strokeStyle = '#4a4a5e';
    ctx.lineWidth = 2;
    for (var i = 0; i < NB.City.ROADS.length; i++) {
      var c = NB.City.ROADS[i] * s;
      ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + c, y + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + c); ctx.lineTo(x + size, y + c); ctx.stroke();
    }
    // safehouse
    ctx.fillStyle = '#7cff00';
    ctx.fillRect(x + NB.City.safehouse.x * s - 3, y + NB.City.safehouse.y * s - 3, 6, 6);
    // mission marker
    var m = NB.Missions ? NB.Missions.markerPos() : null;
    if (m) {
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(x + m.x * s, y + m.y * s, 5, 0, Math.PI * 2); ctx.fill();
    }
    // police
    if (NB.Police) {
      ctx.fillStyle = '#2d7bff';
      for (var j = 0; j < NB.Police.pcars.length; j++) {
        ctx.fillRect(x + NB.Police.pcars[j].x * s - 2, y + NB.Police.pcars[j].y * s - 2, 4, 4);
      }
      ctx.fillStyle = '#7db4ff';
      for (var k = 0; k < NB.Police.cops.length; k++) {
        ctx.fillRect(x + NB.Police.cops[k].x * s - 2, y + NB.Police.cops[k].y * s - 2, 4, 4);
      }
    }
    // player
    var pl = NB.Player ? NB.Player.p : null;
    if (pl) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x + pl.x * s, y + pl.y * s, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x + pl.x * s, y + pl.y * s, 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawStars(ctx, x, y, wanted) {
    ctx.font = '28px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < wanted ? '#ffe600' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x + i * 30, y);
    }
  }

  function draw(ctx, game) {
    var pl = NB.Player.p;
    if (!pl) return;
    buttons.length = 0;
    // health bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(14, 14, 230, 46);
    ctx.fillStyle = '#111';
    ctx.fillRect(20, 20, 180, 14);
    ctx.fillStyle = pl.health > 30 ? '#37d67a' : '#ff3b30';
    ctx.fillRect(20, 20, 180 * Math.max(0, pl.health / pl.maxHealth), 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('HP ' + Math.ceil(pl.health), 206, 20);
    ctx.fillStyle = '#7cff00';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('$' + game.stats.money.toLocaleString('en-US'), 20, 38);
    // objective
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(14, 66, 560, 30);
    ctx.fillStyle = '#ffe600';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText((NB.Missions ? NB.Missions.objectiveText() : ''), 22, 74);
    // wanted stars + minimap
    drawStars(ctx, 1280 - 190, 14, NB.Police ? NB.Police.wanted : 0);
    drawMinimap(ctx, 1280 - 190, 48, 180);
    ctx.fillStyle = '#fff';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEON BAY', 1280 - 190, 232);
    // ammo + speed
    if (pl.onFoot) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('AMMO ' + pl.ammo, 1266, 770);
    } else if (pl.car) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(Math.abs(pl.car.speed) * 0.15) + ' mph', 1266, 758);
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText('SPACE handbrake', 1266, 786);
    }
    // toasts
    ctx.textAlign = 'center';
    for (var i = 0; i < messages.length; i++) {
      var ms = messages[i];
      var a = Math.min(1, ms.t / 0.8);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.65 * a) + ')';
      var tw = ctx.measureText(ms.text).width + 28;
      ctx.fillRect(640 - tw / 2, 700 - i * 30, tw, 24);
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText(ms.text, 640, 705 - i * 30);
    }
    // safehouse / interaction hints
    if (pl.onFoot) {
      var sh = NB.City.safehouse;
      if (Math.hypot(pl.x - sh.x, pl.y - sh.y) < 100) {
        ctx.fillStyle = '#7cff00';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SAFEHOUSE — press E: heal + buy ammo ($50)', 640, 640);
      }
      var car = NB.Vehicles.nearestStealable(pl.x, pl.y, 72);
      if (car) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press E to get in the car', 640, 640);
      }
    }
  }

  function drawStart(ctx, hasSave) {
    buttons.length = 0;
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, 1280, 800);
    // neon skyline silhouette
    var cols = ['#ff2d78', '#00e5ff', '#ffe600', '#7cff00', '#c86bff'];
    for (var i = 0; i < 24; i++) {
      var w = 30 + ((i * 53) % 40), h = 120 + ((i * 97) % 220);
      var x = i * 55;
      ctx.fillStyle = '#141428';
      ctx.fillRect(x, 800 - h, w, h);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(x, 800 - h, w, 3);
    }
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#ff2d78'; ctx.shadowBlur = 34;
    ctx.fillStyle = '#ff2d78';
    ctx.font = 'bold 92px Arial, sans-serif';
    ctx.fillText('NEON BAY', 640, 190);
    ctx.restore();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('An open-world crime story — Rex Vega', 640, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial, sans-serif';
    var lines = [
      'WASD / Arrows — move and drive      E — enter / exit car, interact',
      'Mouse — aim      Click — shoot / punch      SPACE — handbrake',
      'P / ESC — pause      M — mute',
      'Steal cars, dodge the law, run six missions and take the Big One.'
    ];
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], 640, 310 + j * 28);
    button(ctx, 'start', 'START NEW GAME', 490, 470, 300, 52);
    if (hasSave) button(ctx, 'continue', 'CONTINUE', 490, 536, 300, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('A fan-made tribute in the spirit of GTA 1 / 2. All art and sound are generated in code.', 640, 640);
  }

  function drawPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 1280, 800);
    panel(ctx, 440, 250, 400, 300);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 640, 300);
    button(ctx, 'resume', 'RESUME', 490, 350, 300, 48);
    button(ctx, 'restart', 'RESTART GAME', 490, 410, 300, 48);
    button(ctx, 'menu', 'MAIN MENU', 490, 470, 300, 48);
  }

  function drawOverlay(ctx, kind, data) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 1280, 800);
    panel(ctx, 390, 260, 500, 280);
    ctx.textAlign = 'center';
    var title = '', color = '#fff', sub = '';
    if (kind === 'complete') { title = 'MISSION COMPLETE'; color = '#7cff00'; sub = (data && data.name) || ''; }
    if (kind === 'story') { title = 'STORY COMPLETE'; color = '#ffe600'; sub = 'Rex Vega owns Neon Bay.'; }
    if (kind === 'failed') { title = 'MISSION FAILED'; color = '#ff3b30'; sub = 'Try it again, Rex.'; }
    if (kind === 'over') { title = 'WASTED'; color = '#ff3b30'; sub = 'Rex got taken down.'; }
    if (kind === 'busted') { title = 'BUSTED'; color = '#2d7bff'; sub = 'The cops got you.'; }
    ctx.fillStyle = color;
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.fillText(title, 640, 320);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(sub, 640, 360);
    if (data && data.reward) {
      ctx.fillStyle = '#7cff00';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.fillText('+$' + data.reward.toLocaleString('en-US'), 640, 400);
    }
    if (kind === 'complete' || kind === 'story') button(ctx, 'continue', 'CONTINUE', 490, 440, 300, 52);
    if (kind === 'failed') button(ctx, 'retry', 'RETRY MISSION', 490, 440, 300, 52);
    if (kind === 'over' || kind === 'busted') button(ctx, 'respawn', 'RESPAWN AT SAFEHOUSE', 440, 440, 400, 52);
  }

  NB.HUD = {
    buttons: buttons,
    message: message, update: update, draw: draw,
    drawStart: drawStart, drawPause: drawPause, drawOverlay: drawOverlay,
    drawMinimap: drawMinimap
  };
})();
