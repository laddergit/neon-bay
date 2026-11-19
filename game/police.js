'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var wanted = 0;
  var heat = 0;          // 0..1, builds while crimes happen, drains while hidden
  var decayT = 0;
  var crimeT = 0;        // time since the last crime
  var cops = [];         // foot officers
  var pcars = [];        // patrol cars (NB.Vehicles cars with driver 'police')
  var blocks = [];       // roadblocks: {x, y, angle, cars:[]}
  var spawnT = 0;

  function wantedUnits(level) {
    // foot cops, patrol cars, roadblocks
    if (level <= 0) return [0, 0, 0];
    if (level === 1) return [1, 0, 0];
    if (level === 2) return [2, 1, 0];
    if (level === 3) return [2, 2, 0];
    if (level === 4) return [2, 3, 1];
    return [3, 4, 2];
  }

  function addWanted(n, why) {
    var before = wanted;
    wanted = Math.max(0, Math.min(5, wanted + n));
    heat = 1;
    crimeT = 0;
    if (wanted > before) {
      if (NB.HUD) NB.HUD.message('Wanted level ' + wanted + (why ? ' — ' + why : ''));
      NB.Audio.siren();
    }
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(5, n));
    heat = n > 0 ? 1 : 0;
    crimeT = 0;
  }

  function reset() {
    wanted = 0; heat = 0; decayT = 0; crimeT = 0;
    cops.length = 0; blocks.length = 0;
    for (var i = pcars.length - 1; i >= 0; i--) NB.Vehicles.removeCar(pcars[i]);
    pcars.length = 0;
  }

  function spawnCop(px, py) {
    var a = Math.random() * Math.PI * 2;
    var d = 420 + Math.random() * 260;
    var x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
    x = Math.max(40, Math.min(NB.City.WORLD - 40, x));
    y = Math.max(40, Math.min(NB.City.WATER_Y - 40, y));
    if (NB.City.solidAt(x, y, 12)) return;
    cops.push({ x: x, y: y, angle: a, speed: 0, arrestT: 0, step: 0 });
  }

  function spawnPcar(px, py) {
    var rc = NB.City.nearestRoadCenter(px, py);
    var a = Math.random() * Math.PI * 2;
    var x = rc.x + Math.cos(a) * 500, y = rc.y + Math.sin(a) * 500;
    var road = NB.City.roadAt(x, y);
    if (!road) { x = rc.x; y = rc.y; }
    var car = NB.Vehicles.makeCar('police', x, y, Math.atan2(py - y, px - x), 'police');
    car.siren = Math.random() * 10;
    pcars.push(car);
    return car;
  }

  function spawnRoadblock(px, py, pAngle) {
    // two patrol cars parked across the road ahead of the player
    var fx = Math.cos(pAngle), fy = Math.sin(pAngle);
    var bx = px + fx * 420, by = py + fy * 420;
    var road = NB.City.roadAt(bx, by);
    if (!road) return;
    var perp = road.vertical ? 0 : Math.PI / 2;
    var c1 = NB.Vehicles.makeCar('police', bx - Math.cos(perp) * 26, by - Math.sin(perp) * 26, perp, 'police');
    var c2 = NB.Vehicles.makeCar('police', bx + Math.cos(perp) * 26, by + Math.sin(perp) * 26, perp, 'police');
    c1.speed = 0; c2.speed = 0;
    blocks.push({ x: bx, y: by, angle: perp, cars: [c1, c2] });
  }

  function nearestCopDist(px, py) {
    var best = Infinity;
    for (var i = 0; i < cops.length; i++) best = Math.min(best, Math.hypot(cops[i].x - px, cops[i].y - py));
    for (var j = 0; j < pcars.length; j++) best = Math.min(best, Math.hypot(pcars[j].x - px, pcars[j].y - py));
    return best;
  }

  function update(dt, player) {
    crimeT += dt;
    var px = player.x, py = player.y;
    var want = wantedUnits(wanted);
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 1.2;
      if (cops.length < want[0]) spawnCop(px, py);
      if (pcars.length < want[1]) spawnPcar(px, py);
      if (blocks.length < want[2] && player.car) {
        spawnRoadblock(px, py, player.angle);
      }
    }
    // wanted decays when the player is out of sight and quiet
    var near = nearestCopDist(px, py);
    var hidden = near > 420 && crimeT > 6;
    if (wanted > 0 && hidden) {
      decayT += dt * (NB.City.onRoad(px, py) ? 1 : 1.8); // alleys hide better than roads
      if (decayT > 16) {
        decayT = 0;
        wanted--;
        heat = wanted > 0 ? 0.6 : 0;
        if (NB.HUD) NB.HUD.message(wanted > 0 ? 'Wanted level down: ' + wanted : 'You lost the cops');
      }
    } else {
      decayT = 0;
    }
    if (wanted === 0) heat = Math.max(0, heat - dt * 0.2);

    // foot cops: run at the player, grab them on foot
    for (var i = 0; i < cops.length; i++) {
      var c = cops[i];
      c.step += dt * 10;
      var dx = px - c.x, dy = py - c.y;
      var d = Math.hypot(dx, dy);
      if (d > 1) {
        var sp = player.onFoot ? 235 : 190;
        c.x += dx / d * sp * dt;
        c.y += dy / d * sp * dt;
        c.angle = Math.atan2(dy, dx);
      }
      NB.City.resolveCircle(c, 11);
      if (player.onFoot && d < 30) {
        c.arrestT += dt;
        if (c.arrestT > 2.2 && NB.Game) NB.Game.onBusted();
      } else {
        c.arrestT = Math.max(0, c.arrestT - dt * 2);
      }
    }
    // patrol cars: chase and ram
    for (var j = 0; j < pcars.length; j++) {
      var car = pcars[j];
      car.siren += dt;
      if (blocks.length && blocks.some(function (b) { return b.cars.indexOf(car) >= 0; })) continue; // roadblock cars stay put
      var dx2 = px - car.x, dy2 = py - car.y;
      var dist = Math.hypot(dx2, dy2);
      var wantAngle = Math.atan2(dy2, dx2);
      var diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var steer = Math.max(-1, Math.min(1, diff * 2.4));
      var throttle = dist > 90 ? 1 : 0.4;
      if (dist < 46 && player.car) throttle = 1; // ram
      NB.Vehicles.drive(car, dt, throttle, steer, false);
      // ramming the player's car hurts
      if (player.car && dist < 44) {
        if (Math.abs(car.speed) > 150 && NB.Game) {
          NB.Game.onRam(Math.abs(car.speed));
        }
      }
      // a patrol car that touches the player on foot grabs them
      if (player.onFoot && dist < 26 && NB.Game) NB.Game.onBusted();
    }
    // clean up cops that fell far behind
    for (var k = cops.length - 1; k >= 0; k--) {
      if (Math.hypot(cops[k].x - px, cops[k].y - py) > 1500) cops.splice(k, 1);
    }
    for (var m = pcars.length - 1; m >= 0; m--) {
      if (Math.hypot(pcars[m].x - px, pcars[m].y - py) > 1600) {
        NB.Vehicles.removeCar(pcars[m]);
        pcars.splice(m, 1);
      }
    }
    // siren hum while any unit is close
    if (near < 700) NB.Audio.sirenStart(); else NB.Audio.sirenStop();
  }

  function draw(ctx) {
    for (var i = 0; i < cops.length; i++) {
      var c = cops[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      var bob = Math.sin(c.step) * 2;
      ctx.fillStyle = '#101826';
      ctx.fillRect(-6, -7 + bob, 5, 13);
      ctx.fillRect(-6, -6 - bob, 5, 13);
      ctx.fillStyle = '#1c3a6e';
      ctx.fillRect(-7, -8, 14, 16);
      ctx.fillStyle = '#d8d8e0';
      ctx.fillRect(-7, -2, 14, 3);
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath(); ctx.arc(9, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101826';
      ctx.fillRect(4, -6, 9, 4);
      if (c.arrestT > 0.4) {
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('STOP!', 0, -22);
      }
      ctx.restore();
    }
  }

  NB.Police = {
    get wanted() { return wanted; },
    get cops() { return cops; },
    get pcars() { return pcars; },
    get heat() { return heat; },
    addWanted: addWanted, setWanted: setWanted, reset: reset,
    update: update, draw: draw, nearestCopDist: nearestCopDist
  };
})();
