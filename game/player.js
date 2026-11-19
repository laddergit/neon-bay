'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var p = null;
  var pickups = [];
  var PICKUP_SPOTS = [
    { x: 660, y: 260 }, { x: 1460, y: 660 }, { x: 2260, y: 1460 },
    { x: 660, y: 2260 }, { x: 2660, y: 2660 }, { x: 1860, y: 1060 }
  ];

  function create(x, y) {
    p = {
      x: x, y: y, angle: 0, vx: 0, vy: 0,
      onFoot: true, car: null,
      health: 100, maxHealth: 100, ammo: 24,
      shootCd: 0, punchCd: 0, invulnT: 0,
      walkBob: 0, muzzle: 0
    };
    pickups.length = 0; // clear in place: NB.Player.pickups keeps pointing at this array
    for (var i = 0; i < PICKUP_SPOTS.length; i++) {
      pickups.push({ x: PICKUP_SPOTS[i].x, y: PICKUP_SPOTS[i].y, amount: 12 });
    }
    return p;
  }

  function dropPickup(x, y, amount) {
    pickups.push({ x: x, y: y, amount: amount });
  }

  function makeFleeingPed(x, y) {
    var shirts = ['#e8e8e8', '#ff9d5c', '#7ec8ff', '#ffd24d'];
    NB.Peds.list.push({
      x: x, y: y, angle: Math.random() * Math.PI * 2,
      speed: 150, state: 'flee',
      shirt: shirts[Math.floor(Math.random() * shirts.length)],
      skin: '#e0ac69', target: null, fleeT: 4, downT: 0, step: 0
    });
  }

  function enterCar(car) {
    if (!car) return;
    if (car.driver === 'traffic') {
      // yank the driver out: they flee on foot
      makeFleeingPed(car.x + 26, car.y + 26);
      if (NB.Game) NB.Game.onCrime('carjack');
    } else if (car.driver === 'parked') {
      if (NB.Game) NB.Game.onCrime('steal');
    }
    car.driver = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y;
    if (NB.Game) NB.Game.onCarStolen();
    NB.Audio.engineStart();
    NB.Audio.blip();
  }

  function exitCar() {
    if (!p.car) return;
    var car = p.car;
    car.driver = 'parked';
    car.speed = 0; car.vx = 0; car.vy = 0;
    // step out on the left side of the car
    var sx = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    var sy = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    p.x = sx; p.y = sy;
    NB.City.resolveCircle(p, 12);
    p.onFoot = true;
    p.car = null;
    p.vx = 0; p.vy = 0;
    NB.Audio.engineSet(0, false);
  }

  function damage(amount, from) {
    if (p.invulnT > 0) return;
    p.health -= amount;
    p.invulnT = 0.35;
    if (NB.Game) NB.Game.addShake(6);
    if (p.health <= 0) {
      p.health = 0;
      if (NB.Game) NB.Game.onPlayerDown(from);
    }
  }

  function heal(amount) {
    p.health = Math.min(p.maxHealth, p.health + amount);
  }

  function update(dt, input) {
    if (!p) return;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.muzzle > 0) p.muzzle -= dt;

    if (p.onFoot) {
      var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      var len = Math.hypot(mx, my);
      var target = input.run ? 300 : 170;
      if (len > 0) {
        p.vx += mx / len * 1400 * dt;
        p.vy += my / len * 1400 * dt;
        var sp = Math.hypot(p.vx, p.vy);
        if (sp > target) { p.vx *= target / sp; p.vy *= target / sp; }
        p.walkBob += dt * 11;
      } else {
        p.vx *= Math.max(0, 1 - 10 * dt);
        p.vy *= Math.max(0, 1 - 10 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      NB.City.resolveCircle(p, 12);
      // cannot walk through cars
      for (var i = 0; i < NB.Vehicles.list.length; i++) {
        var c = NB.Vehicles.list[i];
        var dx = p.x - c.x, dy = p.y - c.y;
        var d = Math.hypot(dx, dy);
        if (d < 26 && d > 0.01) { p.x = c.x + dx / d * 26; p.y = c.y + dy / d * 26; }
      }
      // aim at the mouse
      var m = input.mouseWorld;
      p.angle = Math.atan2(m.y - p.y, m.x - p.x);
      // shoot or punch — hold the mouse to keep firing at the pistol's rate
      if (input.clicked || input.holding) {
        if (p.ammo > 0 && p.shootCd <= 0) {
          p.ammo--;
          p.shootCd = 0.22;
          p.muzzle = 0.06;
          var gx = p.x + Math.cos(p.angle) * 20, gy = p.y + Math.sin(p.angle) * 20;
          if (NB.Game) NB.Game.spawnBullet(gx, gy, p.angle + (Math.random() - 0.5) * 0.05, 760, 'player', 34);
          NB.Audio.shot();
          if (NB.Game) NB.Game.addShake(1.5);
        } else if (p.ammo <= 0 && p.punchCd <= 0) {
          p.punchCd = 0.45;
          NB.Audio.punch();
          if (NB.Game) NB.Game.meleeHit(p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34, 46, 20, p.angle);
        }
      }
      // E: enter a car, use the safehouse, or do a mission interaction
      if (input.pressedE) {
        var car = NB.Vehicles.nearestStealable(p.x, p.y, 72);
        if (car) { enterCar(car); return; }
        var sh = NB.City.safehouse;
        if (Math.hypot(p.x - sh.x, p.y - sh.y) < 100) {
          heal(100);
          if (NB.Game && NB.Game.stats.money >= 50 && p.ammo < 72) {
            NB.Game.stats.money -= 50;
            p.ammo = Math.min(96, p.ammo + 24);
            if (NB.HUD) NB.HUD.message('Ammo restocked: +24 rounds ($50)');
          } else {
            if (NB.HUD) NB.HUD.message('Safehouse: health restored');
          }
          NB.Audio.pickup();
          return;
        }
        if (NB.Missions) NB.Missions.interact();
      }
      // pick up ammo boxes
      for (var j = pickups.length - 1; j >= 0; j--) {
        var pk = pickups[j];
        if (Math.hypot(p.x - pk.x, p.y - pk.y) < 26) {
          p.ammo = Math.min(96, p.ammo + pk.amount);
          pickups.splice(j, 1);
          NB.Audio.pickup();
          if (NB.HUD) NB.HUD.message('Picked up +' + pk.amount + ' ammo');
        }
      }
      // slow heal near the safehouse
      var shd = Math.hypot(p.x - NB.City.safehouse.x, p.y - NB.City.safehouse.y);
      if (shd < 130) heal(9 * dt);
      NB.Audio.engineSet(0, false);
    } else if (p.car) {
      var car = p.car;
      var throttle = (input.up ? 1 : 0) - (input.down ? 0.6 : 0);
      var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      var slide = NB.Vehicles.drive(car, dt, throttle, steer, input.handbrake);
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      var ratio = Math.abs(car.speed) / car.maxSpeed;
      NB.Audio.engineSet(ratio, true);
      if (input.handbrake && Math.abs(car.speed) > 140) {
        NB.Audio.skidStart();
        NB.Audio.skidSet(0.1);
        if (Math.random() < dt * 30 && NB.Game) {
          NB.Game.spawnParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 2, '#888888', 30);
        }
      } else {
        NB.Audio.skidSet(0);
      }
      if (slide > 90 && Math.random() < dt * 20 && NB.Game) {
        NB.Game.spawnParticles(car.x, car.y, 1, '#aaaaaa', 22);
      }
      // running over pedestrians is a crime
      var hit = NB.Peds.knock(car.x + Math.cos(car.angle) * 24, car.y + Math.sin(car.angle) * 24, 30, car.angle, 26);
      if (hit > 0 && Math.abs(car.speed) > 60) {
        if (NB.Game) NB.Game.onCrime('ped');
        NB.Audio.crash(0.4);
        if (NB.Game) NB.Game.addShake(4);
      }
      if (input.pressedE) exitCar();
    }
  }

  function draw(ctx) {
    // ammo pickups are visible whether Rex is on foot or driving
    for (var k = 0; k < pickups.length; k++) {
      var pk = pickups[k];
      var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 350 + pk.x);
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.strokeStyle = 'rgba(124,255,0,' + (0.25 + 0.35 * pulse) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 16 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1d4028';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = '#7cff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(-6, -3, 3, 6);
      ctx.fillRect(-1, -3, 3, 6);
      ctx.fillRect(4, -3, 3, 6);
      ctx.restore();
    }
    if (!p || !p.onFoot) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    var bob = Math.sin(p.walkBob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 3, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = '#1d2a4a';
    ctx.fillRect(-5, -7 + bob, 5, 13);
    ctx.fillRect(-5, -6 - bob, 5, 13);
    // jacket (Rex wears a red jacket)
    ctx.fillStyle = '#c22a2a';
    ctx.fillRect(-7, -8, 14, 16);
    ctx.fillStyle = '#e8b13c';
    ctx.fillRect(-7, -2, 14, 3);
    // head
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(9, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(4, -7, 8, 4);
    // pistol
    ctx.fillStyle = '#22222e';
    ctx.fillRect(10, -2, 14, 4);
    if (p.muzzle > 0) {
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(28, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a00';
      ctx.beginPath(); ctx.arc(28, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  NB.Player = {
    get p() { return p; },
    create: create, update: update, draw: draw,
    enterCar: enterCar, exitCar: exitCar,
    damage: damage, heal: heal, dropPickup: dropPickup,
    pickups: pickups
  };
})();
