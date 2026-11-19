'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var canvas = null, ctx = null;
  var state = 'menu'; // menu | playing | paused | overlay
  var overlay = null; // {kind, data}
  var camera = { x: 1600, y: 1600, w: 1280, h: 800, zoom: 1, shake: 0 };
  var particles = [];
  var bullets = [];
  var threats = [];
  var keys = {};
  var mouse = { x: 640, y: 400, down: false, clicked: false };
  var pressedE = false;
  var lastT = 0, tGlobal = 0;
  var autoplay = false;
  var saveT = 0;
  var hasSave = false;
  var errors = [];
  var stats = { money: 0, missionsDone: 0, carsStolen: 0 };

  var SAVE_KEY = 'neonbay-save-v1';

  window.addEventListener('error', function (e) { errors.push(String(e.message)); });

  function spawnParticles(x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (speed || 60) * (0.4 + Math.random() * 0.8);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.4, max: 0.8, color: color, size: 2 + Math.random() * 3
      });
    }
  }

  function addShake(m) { camera.shake = Math.min(14, camera.shake + m); }

  function spawnBullet(x, y, angle, speed, from, damage) {
    bullets.push({
      x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1.1, from: from, damage: damage
    });
    threats.push({ x: x, y: y, r: 320, t: 0.7 });
  }

  function meleeHit(x, y, r, damage, angle) {
    var hit = 0;
    var cur = NB.Missions.current;
    if (cur && cur.attackers) {
      for (var i = 0; i < cur.attackers.length; i++) {
        var at = cur.attackers[i];
        if (Math.hypot(at.x - x, at.y - y) < r + 12) {
          at.hp -= damage;
          at.x += Math.cos(angle) * 14; at.y += Math.sin(angle) * 14;
          spawnParticles(at.x, at.y, 5, '#ff5a5a', 50);
          hit++;
        }
      }
    }
    var cops = NB.Police.cops;
    for (var j = 0; j < cops.length; j++) {
      if (Math.hypot(cops[j].x - x, cops[j].y - y) < r + 10) {
        cops[j].x += Math.cos(angle) * 16; cops[j].y += Math.sin(angle) * 16;
        hit++;
      }
    }
    if (hit === 0) {
      var ped = NB.Peds.nearest(x, y, r);
      if (ped) { NB.Peds.knock(x, y, r, angle, 20); onCrime('punch'); }
    }
    return hit;
  }

  var crimeCooldown = {};
  function onCrime(type) {
    var now = tGlobal;
    if (crimeCooldown[type] && now - crimeCooldown[type] < 2.5) return;
    crimeCooldown[type] = now;
    if (type === 'steal' || type === 'carjack') NB.Police.addWanted(1, type === 'carjack' ? 'carjacking' : 'car theft');
    else if (type === 'ped' || type === 'shoot') NB.Police.addWanted(1, type === 'ped' ? 'hit a pedestrian' : 'shooting');
    else if (type === 'cop') NB.Police.addWanted(2, 'attacked an officer');
    else if (type === 'punch') NB.Police.addWanted(1, 'assault');
  }

  function onCarStolen() { stats.carsStolen++; }

  function onCarCrash(a, b, rel) {
    var pl = NB.Player.p;
    var involvesPlayer = (pl.car && (a === pl.car || b === pl.car));
    NB.Audio.crash(Math.min(1, rel / 500));
    addShake(Math.min(8, rel / 60));
    if (a) spawnParticles(a.x, a.y, 6, '#ffb347', 90);
    if (b) spawnParticles(b.x, b.y, 6, '#ffb347', 90);
    if (involvesPlayer && rel > 320) {
      NB.Player.damage((rel - 320) / 45, 'crash');
    }
  }

  function onRam(speed) {
    NB.Audio.crash(0.5);
    addShake(5);
    NB.Player.damage(Math.max(2, (speed - 150) / 40), 'ram');
  }

  function onPlayerDown(from) {
    if (NB.Missions.phase === 'active') {
      NB.Missions.fail();
    } else {
      showOverlay('over', {});
    }
  }

  function onBusted() {
    if (NB.Missions.phase === 'active') {
      NB.Missions.fail();
    } else {
      showOverlay('busted', {});
    }
  }

  function showOverlay(kind, data) {
    overlay = { kind: kind, data: data || {} };
    state = 'overlay';
  }

  function onMissionStarted(def) { /* banner is shown by the HUD message */ }

  function onMissionComplete(def, reward) {
    stats.money += reward;
    stats.missionsDone++;
    NB.Audio.jingle();
    save();
    if (NB.Missions.index >= NB.Missions.defs.length) showOverlay('story', { name: def.name, reward: reward });
    else showOverlay('complete', { name: def.name, reward: reward });
  }

  function onMissionFailed() {
    NB.Audio.fail();
    showOverlay('failed', {});
  }

  function respawn() {
    var pl = NB.Player.p;
    if (pl.car) { pl.car.driver = 'parked'; pl.car.speed = 0; pl.car.vx = 0; pl.car.vy = 0; pl.car = null; }
    pl.onFoot = true;
    pl.x = NB.City.safehouse.x; pl.y = NB.City.safehouse.y;
    pl.health = pl.maxHealth;
    pl.ammo = Math.max(pl.ammo, 12);
    pl.vx = 0; pl.vy = 0;
    NB.Police.reset();
    stats.money = Math.max(0, stats.money - 200);
    overlay = null;
    state = 'playing';
    save();
  }

  function save() {
    try {
      var pl = NB.Player.p;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: stats.money, missionsDone: stats.missionsDone, carsStolen: stats.carsStolen,
        missionIndex: NB.Missions.index, health: pl.health, ammo: pl.ammo, x: pl.x, y: pl.y
      }));
    } catch (e) {}
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      stats.money = s.money || 0;
      stats.missionsDone = s.missionsDone || 0;
      stats.carsStolen = s.carsStolen || 0;
      NB.Missions.index = s.missionIndex || 0;
      var pl = NB.Player.p;
      pl.health = s.health || 100;
      pl.ammo = s.ammo || 24;
      pl.x = s.x || NB.City.safehouse.x;
      pl.y = s.y || NB.City.safehouse.y;
      return true;
    } catch (e) { return false; }
  }

  function newGame() {
    stats.money = 0; stats.missionsDone = 0; stats.carsStolen = 0;
    NB.Missions.reset();
    NB.Police.reset();
    NB.Vehicles.clear();
    NB.Vehicles.spawnParked();
    NB.Vehicles.spawnTraffic(10, NB.City.safehouse.x, NB.City.safehouse.y);
    NB.Peds.clear();
    NB.Peds.spawn(16, NB.City.safehouse.x, NB.City.safehouse.y);
    NB.Player.create(NB.City.safehouse.x, NB.City.safehouse.y);
    bullets.length = 0; particles.length = 0; threats.length = 0;
    overlay = null;
    state = 'playing';
    camera.x = NB.City.safehouse.x; camera.y = NB.City.safehouse.y;
    NB.HUD.message('Welcome to Neon Bay, Rex. Head to the safehouse (!) for your first job.');
    save();
  }

  function onButton(id) {
    NB.Audio.init();
    NB.Audio.click();
    if (id === 'start') newGame();
    else if (id === 'continue') {
      if (overlay) { overlay = null; state = 'playing'; }
      else { loadSave(); state = 'playing'; }
    }
    else if (id === 'resume') state = 'playing';
    else if (id === 'restart') newGame();
    else if (id === 'menu') { state = 'menu'; overlay = null; }
    else if (id === 'retry') respawn();
    else if (id === 'respawn') respawn();
  }

  function buildInput() {
    var pl = NB.Player.p;
    var rect = canvas.getBoundingClientRect();
    var sx = (mouse.x - rect.left) * (canvas.width / rect.width);
    var sy = (mouse.y - rect.top) * (canvas.height / rect.height);
    var mw = {
      x: camera.x + (sx - 640) / camera.zoom,
      y: camera.y + (sy - 400) / camera.zoom
    };
    var input = {
      up: !!(keys['KeyW'] || keys['ArrowUp']),
      down: !!(keys['KeyS'] || keys['ArrowDown']),
      left: !!(keys['KeyA'] || keys['ArrowLeft']),
      right: !!(keys['KeyD'] || keys['ArrowRight']),
      run: !!keys['ShiftLeft'] || !!keys['ShiftRight'],
      handbrake: !!keys['Space'],
      pressedE: pressedE,
      clicked: mouse.clicked,
      holding: mouse.down,
      mouseWorld: mw
    };
    pressedE = false;
    mouse.clicked = false;
    if (autoplay && pl && pl.car) {
      // autopilot: follow the road ahead
      var ahead = NB.City.nearestRoadCenter(pl.x + Math.cos(pl.angle) * 260, pl.y + Math.sin(pl.angle) * 260);
      var tx = ahead.x, ty = ahead.y;
      var want = Math.atan2(ty - pl.y, tx - pl.x);
      var diff = want - pl.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      input.up = true;
      input.down = false;
      input.left = diff < -0.08;
      input.right = diff > 0.08;
      input.handbrake = false;
    }
    return input;
  }

  function update(dt) {
    tGlobal += dt;
    var pl = NB.Player.p;
    var input = buildInput();
    NB.Player.update(dt, input);
    NB.Vehicles.update(dt, camera);
    NB.Peds.update(dt, threats);
    NB.Police.update(dt, pl);
    NB.Missions.update(dt);
    // bullets
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      var dead = b.life <= 0;
      if (!dead && NB.City.solidAt(b.x, b.y, 2)) {
        spawnParticles(b.x, b.y, 4, '#ffe600', 70);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        var cur = NB.Missions.current;
        if (cur && cur.attackers) {
          for (var a = 0; a < cur.attackers.length; a++) {
            var at = cur.attackers[a];
            if (Math.hypot(at.x - b.x, at.y - b.y) < 16) {
              at.hp -= b.damage;
              spawnParticles(b.x, b.y, 5, '#ff5a5a', 60);
              dead = true; break;
            }
          }
        }
        if (!dead) {
          var cops = NB.Police.cops;
          for (var c = 0; c < cops.length; c++) {
            var cop = cops[c];
            if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
              if (cop.hp === undefined) cop.hp = 60;
              cop.hp -= b.damage;
              spawnParticles(b.x, b.y, 5, '#ff5a5a', 60);
              if (cop.hp <= 0) {
                cops.splice(c, 1);
                onCrime('cop');
                if (NB.HUD) NB.HUD.message('Officer down — the heat is on you now');
              }
              dead = true; break;
            }
          }
        }
        if (!dead) {
          var ped = NB.Peds.nearest(b.x, b.y, 14);
          if (ped) {
            NB.Peds.knock(b.x, b.y, 20, Math.atan2(b.vy, b.vx), 18);
            onCrime('shoot');
            dead = true;
          }
        }
      }
      if (!dead && b.from === 'enemy' && pl.onFoot) {
        if (Math.hypot(pl.x - b.x, pl.y - b.y) < 14) {
          NB.Player.damage(b.damage, 'shot');
          spawnParticles(b.x, b.y, 4, '#ff5a5a', 50);
          dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    // traffic cars can run the player down on foot
    if (pl.onFoot) {
      for (var v = 0; v < NB.Vehicles.list.length; v++) {
        var car = NB.Vehicles.list[v];
        if (car.driver === 'parked') continue;
        if (Math.hypot(car.x - pl.x, car.y - pl.y) < 24 && Math.abs(car.speed) > 110) {
          NB.Player.damage(14, 'traffic');
          pl.x += (pl.x - car.x) * 0.6; pl.y += (pl.y - car.y) * 0.6;
        }
      }
    }
    // particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - 3 * dt); pt.vy *= Math.max(0, 1 - 3 * dt);
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }
    for (var t = threats.length - 1; t >= 0; t--) {
      threats[t].t -= dt;
      if (threats[t].t <= 0) threats.splice(t, 1);
    }
    // camera
    var tz = pl.car ? 0.86 : 1.0;
    camera.zoom += (tz - camera.zoom) * Math.min(1, 2 * dt);
    var kx = 1 - Math.exp(-6 * dt);
    camera.x += (pl.x - camera.x) * kx;
    camera.y += (pl.y - camera.y) * kx;
    camera.shake *= Math.max(0, 1 - 5 * dt);
    NB.HUD.update(dt);
    saveT += dt;
    if (saveT > 10) { saveT = 0; save(); }
  }

  function render() {
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, 1280, 800);
    if (state === 'menu') {
      NB.HUD.drawStart(ctx, hasSave);
      return;
    }
    var shx = (Math.random() - 0.5) * camera.shake;
    var shy = (Math.random() - 0.5) * camera.shake;
    ctx.save();
    ctx.translate(640, 400);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x + shx, -camera.y + shy);
    NB.City.draw(ctx, camera);
    NB.Missions.draw(ctx, tGlobal);
    NB.Peds.draw(ctx);
    NB.Vehicles.draw(ctx);
    NB.Player.draw(ctx);
    NB.Police.draw(ctx);
    // bullets
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 3;
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // particles
    for (var j = 0; j < particles.length; j++) {
      var pt = particles[j];
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // edge arrow to the mission marker
    var m = NB.Missions.markerPos();
    if (m && state === 'playing') {
      var mx = (m.x - camera.x) * camera.zoom + 640;
      var my = (m.y - camera.y) * camera.zoom + 400;
      if (mx < 40 || mx > 1240 || my < 40 || my > 760) {
        var cx = Math.max(50, Math.min(1230, mx));
        var cy = Math.max(50, Math.min(750, my));
        var ang = Math.atan2(my - cy, mx - cx);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    NB.HUD.draw(ctx, { stats: stats });
    if (state === 'paused') NB.HUD.drawPause(ctx);
    if (state === 'overlay' && overlay) NB.HUD.drawOverlay(ctx, overlay.kind, overlay.data);
  }

  function loop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (state === 'playing') update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function setupScene(name) {
    var pl = NB.Player.p;
    if (name === 'drive') {
      var car = NB.Vehicles.makeCar('sports', 1400, 1000, 0, 'player');
      car.color = '#e33e3e';
      pl.car = car; pl.onFoot = false; pl.x = car.x; pl.y = car.y;
      stats.money = 2500;
      NB.Police.setWanted(2);
      NB.Vehicles.makeCar('police', 1200, 1000, 0, 'police');
      autoplay = true;
      camera.x = car.x; camera.y = car.y;
    } else if (name === 'foot') {
      pl.x = 940; pl.y = 260;
      pl.ammo = 24;
      NB.Missions.start(0);
      camera.x = pl.x; camera.y = pl.y;
    } else if (name === 'mission') {
      // shootout at the safehouse: mission 5, wave 1 closing in
      pl.x = NB.City.safehouse.x; pl.y = NB.City.safehouse.y + 40;
      pl.ammo = 48;
      NB.Missions.start(4);
      camera.x = pl.x; camera.y = pl.y;
    } else if (name === 'chase') {
      var car2 = NB.Vehicles.makeCar('sports', 1800, 1800, Math.PI / 2, 'player');
      car2.color = '#e33e3e';
      pl.car = car2; pl.onFoot = false; pl.x = car2.x; pl.y = car2.y;
      stats.money = 4300;
      NB.Police.setWanted(4);
      NB.Vehicles.makeCar('police', 1800, 1500, Math.PI / 2, 'police');
      NB.Vehicles.makeCar('police', 1500, 1800, 0, 'police');
      NB.Vehicles.makeCar('police', 2100, 1800, Math.PI, 'police');
      autoplay = true;
      camera.x = car2.x; camera.y = car2.y;
    }
    state = 'playing';
  }

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    NB.City.build();
    NB.Vehicles.spawnParked();
    NB.Vehicles.spawnTraffic(10, NB.City.safehouse.x, NB.City.safehouse.y);
    NB.Peds.spawn(16, NB.City.safehouse.x, NB.City.safehouse.y);
    NB.Player.create(NB.City.safehouse.x, NB.City.safehouse.y);
    try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { hasSave = false; }
    if (hasSave) loadSave();

    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
      if (e.repeat) return;
      keys[e.code] = true;
      if (e.code === 'KeyE') pressedE = true;
      if (e.code === 'KeyM') {
        var m = NB.Audio.toggleMute();
        if (NB.HUD) NB.HUD.message(m ? 'Sound muted' : 'Sound on');
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (state === 'playing') state = 'paused';
        else if (state === 'paused') state = 'playing';
      }
      if (e.code === 'Enter') {
        if (state === 'menu') onButton(hasSave ? 'continue' : 'start');
        else if (state === 'overlay' && overlay) {
          if (overlay.kind === 'complete' || overlay.kind === 'story') onButton('continue');
          else if (overlay.kind === 'failed') onButton('retry');
          else onButton('respawn');
        }
      }
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX; mouse.y = e.clientY;
    });
    canvas.addEventListener('mousedown', function (e) {
      NB.Audio.init();
      var r = canvas.getBoundingClientRect();
      var sx = (e.clientX - r.left) * (canvas.width / r.width);
      var sy = (e.clientY - r.top) * (canvas.height / r.height);
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (state === 'menu' || state === 'paused' || state === 'overlay') {
        var btns = NB.HUD.buttons;
        for (var i = 0; i < btns.length; i++) {
          var b = btns[i];
          if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
            onButton(b.id);
            return;
          }
        }
        return;
      }
      mouse.clicked = true;
      mouse.down = true;
    });
    window.addEventListener('mouseup', function () { mouse.down = false; });

    var params = new URLSearchParams(window.location.search);
    var scene = params.get('scene');
    if (scene) setupScene(scene);
    requestAnimationFrame(loop);
  }

  window.__NB = {
    version: 'neon-bay-1',
    state: function () { return state; },
    overlay: function () { return overlay; },
    player: function () { return NB.Player.p; },
    wanted: function () { return NB.Police.wanted; },
    mission: function () { return { index: NB.Missions.index, phase: NB.Missions.phase }; },
    stats: stats,
    camera: camera,
    errors: errors,
    cars: function () { return NB.Vehicles.list.length; },
    peds: function () { return NB.Peds.list.length; },
    teleport: function (x, y) {
      var pl = NB.Player.p;
      if (pl.car) { pl.car.x = x; pl.car.y = y; }
      pl.x = x; pl.y = y;
      camera.x = x; camera.y = y;
    },
    setWanted: function (n) { NB.Police.setWanted(n); },
    startMission: function (i) { NB.Missions.start(i); },
    giveAmmo: function (n) { NB.Player.p.ammo += n; },
    setMoney: function (n) { stats.money = n; }
  };

  NB.Game = {
    get state() { return state; },
    camera: camera, stats: stats,
    spawnParticles: spawnParticles, addShake: addShake, spawnBullet: spawnBullet,
    meleeHit: meleeHit, onCrime: onCrime, onCarStolen: onCarStolen,
    onCarCrash: onCarCrash, onRam: onRam, onPlayerDown: onPlayerDown, onBusted: onBusted,
    onMissionStarted: onMissionStarted, onMissionComplete: onMissionComplete,
    onMissionFailed: onMissionFailed, save: save, loadSave: loadSave,
    newGame: newGame, respawn: respawn, onButton: onButton,
    errors: errors
  };

  init();
})();
