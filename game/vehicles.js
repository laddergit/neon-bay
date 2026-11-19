'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var KINDS = {
    sedan:   { len: 46, wid: 22, maxSpeed: 380, accel: 260, color: '#4a6fa5' },
    taxi:    { len: 46, wid: 22, maxSpeed: 370, accel: 260, color: '#f2c200' },
    sports:  { len: 48, wid: 22, maxSpeed: 520, accel: 340, color: '#e33e3e' },
    truck:   { len: 62, wid: 26, maxSpeed: 300, accel: 200, color: '#7a7f85' },
    police:  { len: 48, wid: 23, maxSpeed: 470, accel: 320, color: '#1c2733' },
    van:     { len: 54, wid: 24, maxSpeed: 330, accel: 220, color: '#5a7a5a' }
  };
  var TRAFFIC_COLORS = ['#4a6fa5', '#8a8f96', '#c96f4a', '#5a7a5a', '#7a5a9e', '#b5533c', '#3f6f6f'];

  var cars = [];
  var carId = 0;

  function makeCar(kind, x, y, angle, driver) {
    var k = KINDS[kind] || KINDS.sedan;
    var car = {
      id: ++carId, kind: kind, x: x, y: y, angle: angle, speed: 0,
      vx: 0, vy: 0, len: k.len, wid: k.wid, maxSpeed: k.maxSpeed, accel: k.accel,
      color: k.color, driver: driver || 'traffic',
      cruise: 120 + Math.random() * 60,
      road: null, dir: 1, turnAt: 0, stuck: 0,
      siren: 0, smoke: 0, dead: false
    };
    cars.push(car);
    return car;
  }

  function removeCar(car) {
    var i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  function clear() { cars.length = 0; }

  function lanePoint(road, dir) {
    // right-hand traffic: pick the lane for this road and direction
    if (road.vertical) return { x: road.coord + (dir > 0 ? -20 : 20), vertical: true };
    return { y: road.coord + (dir > 0 ? 20 : -20), vertical: false };
  }

  function spawnTraffic(n, cx, cy) {
    var City = NB.City;
    for (var i = 0; i < n; i++) {
      var road = City.ROADS[Math.floor(Math.random() * City.ROADS.length)];
      var vertical = Math.random() < 0.5;
      var dir = Math.random() < 0.5 ? 1 : -1;
      var along = 100 + Math.random() * (City.WORLD - 200);
      var x, y, angle;
      if (vertical) { x = road + (dir > 0 ? -20 : 20); y = along; angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { y = road + (dir > 0 ? 20 : -20); x = along; angle = dir > 0 ? 0 : Math.PI; }
      // keep traffic near the camera at first
      if (cx !== undefined && Math.hypot(x - cx, y - cy) > 1100) { i--; continue; }
      var kind = ['sedan', 'sedan', 'taxi', 'van', 'truck'][Math.floor(Math.random() * 5)];
      var car = makeCar(kind, x, y, angle, 'traffic');
      car.color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
      car.road = { vertical: vertical, coord: road };
      car.dir = dir;
      car.speed = car.cruise;
    }
  }

  function spawnParked() {
    var spots = [
      { x: 640, y: 248, kind: 'sedan' }, { x: 1048, y: 648, kind: 'taxi' },
      { x: 1448, y: 1048, kind: 'van' }, { x: 2248, y: 1448, kind: 'sedan' },
      { x: 648, y: 1848, kind: 'truck' }, { x: 2648, y: 648, kind: 'sedan' },
      { x: 1848, y: 2648, kind: 'taxi' }, { x: 1048, y: 2248, kind: 'sedan' },
      { x: 2848, y: 2248, kind: 'van' }, { x: 448, y: 1448, kind: 'sedan' }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var car = makeCar(s.kind, s.x, s.y, (i % 2 === 0) ? 0 : Math.PI / 2, 'parked');
      car.color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
    }
  }

  // Arcade car physics shared by the player car and the police: velocity vector,
  // forward acceleration along the nose, lateral grip (low grip = handbrake slide).
  function drive(car, dt, throttle, steer, handbrake) {
    var fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    var fwd = car.vx * fx + car.vy * fy;
    var latX = car.vx - fwd * fx, latY = car.vy - fwd * fy;
    var grip = handbrake ? 1.6 : 7.0;
    latX *= Math.max(0, 1 - grip * dt);
    latY *= Math.max(0, 1 - grip * dt);
    fwd += throttle * car.accel * dt;
    if (throttle === 0) fwd *= Math.max(0, 1 - 0.6 * dt);
    if (fwd > car.maxSpeed) fwd = car.maxSpeed;
    if (fwd < -130) fwd = -130;
    var steerRate = 2.4 * Math.min(1, Math.abs(fwd) / 160 + 0.25) * (fwd < 0 ? -1 : 1);
    if (handbrake) steerRate *= 1.6;
    car.angle += steer * steerRate * dt * (Math.abs(fwd) > 12 ? 1 : 0);
    fx = Math.cos(car.angle); fy = Math.sin(car.angle);
    car.vx = fwd * fx + latX;
    car.vy = fwd * fy + latY;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.speed = fwd;
    return Math.abs(latX) + Math.abs(latY);
  }

  function carAhead(car, dist) {
    var fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    var best = null, bestD = dist;
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o === car || o.driver === 'parked') continue;
      var dx = o.x - car.x, dy = o.y - car.y;
      var along = dx * fx + dy * fy;
      var side = Math.abs(-dx * fy + dy * fx);
      if (along > 0 && along < bestD && side < 26) { best = o; bestD = along; }
    }
    return best;
  }

  function updateTraffic(dt, cam) {
    var City = NB.City;
    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      if (car.driver !== 'traffic') continue;
      var road = car.road;
      if (!road) continue;
      // follow the lane
      var lane = lanePoint(road, car.dir);
      var tx, ty;
      if (road.vertical) { tx = lane.x; ty = car.y + car.dir * 100; }
      else { tx = car.x + car.dir * 100; ty = lane.y; }
      var want = Math.atan2(ty - car.y, tx - car.x);
      var diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var steer = Math.max(-1, Math.min(1, diff * 2.2));
      var ahead = carAhead(car, 90);
      var throttle = ahead ? 0.15 : 0.55;
      if (ahead && car.speed > 40) throttle = -0.4;
      drive(car, dt, throttle, steer, false);
      // at an intersection, sometimes turn onto the crossing road
      var nearCross = false;
      for (var r = 0; r < City.ROADS.length; r++) {
        var c = City.ROADS[r];
        if (road.vertical && Math.abs(car.y - c) < 46) nearCross = true;
        if (!road.vertical && Math.abs(car.x - c) < 46) nearCross = true;
      }
      if (nearCross && Math.random() < dt * 0.5) {
        var cross = City.ROADS[Math.floor(Math.random() * City.ROADS.length)];
        if (road.vertical) {
          car.road = { vertical: false, coord: cross };
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.y = cross + (car.dir > 0 ? 20 : -20);
          car.angle = car.dir > 0 ? 0 : Math.PI;
        } else {
          car.road = { vertical: true, coord: cross };
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.x = cross + (car.dir > 0 ? -20 : 20);
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      // keep traffic near the action: respawn far cars close by
      if (cam && Math.hypot(car.x - cam.x, car.y - cam.y) > 1400) {
        removeCar(car);
        i--;
      }
    }
    // keep the streets alive
    var trafficCount = 0;
    for (var j = 0; j < cars.length; j++) if (cars[j].driver === 'traffic') trafficCount++;
    if (trafficCount < 9 && cam) spawnTraffic(9 - trafficCount, cam.x, cam.y);
  }

  function collideCars(dt) {
    for (var i = 0; i < cars.length; i++) {
      var a = cars[i];
      for (var j = i + 1; j < cars.length; j++) {
        var b = cars[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.hypot(dx, dy);
        var min = (a.len + b.len) / 2 - 8;
        if (d > 0.01 && d < min) {
          var push = (min - d) / 2;
          var nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          var rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
          if (rel > 120 && NB.Game) NB.Game.onCarCrash(a, b, rel);
          a.vx *= 0.94; a.vy *= 0.94; b.vx *= 0.94; b.vy *= 0.94;
        }
      }
    }
  }

  function collideBuildings() {
    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      if (car.driver === 'parked') continue;
      var hit = NB.City.resolveCircle(car, 17);
      if (hit) {
        var impact = Math.hypot(car.vx, car.vy);
        if (impact > 200 && NB.Game) NB.Game.onCarCrash(car, null, impact);
        car.vx *= 0.4; car.vy *= 0.4;
        car.speed *= 0.4;
      }
    }
  }

  function update(dt, cam) {
    updateTraffic(dt, cam);
    collideCars(dt);
    collideBuildings();
  }

  function nearestStealable(x, y, maxD) {
    var best = null, bestD = maxD;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.driver !== 'parked' && c.driver !== 'traffic') continue;
      var d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function drawCar(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
    ctx.fillStyle = car.color;
    ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, car.wid);
    ctx.fillStyle = '#101018';
    ctx.fillRect(-car.len / 2 + 8, -car.wid / 2 + 3, 12, car.wid - 6);
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(-car.len / 2 + 12, -car.wid / 2 + 4, 10, car.wid - 8);
    ctx.fillStyle = '#22222e';
    ctx.fillRect(car.len / 2 - 14, -car.wid / 2 + 3, 10, car.wid - 6);
    if (car.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -car.wid / 2, 12, car.wid);
      ctx.fillStyle = '#1c2733';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      if (car.siren > 0) {
        var c = (Math.floor(car.siren * 6) % 2 === 0) ? '#ff2d55' : '#2d7bff';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.len / 2 - 2, -car.wid / 2 + 3, 3, 5);
    ctx.fillRect(car.len / 2 - 2, car.wid / 2 - 8, 3, 5);
    ctx.restore();
  }

  function draw(ctx) {
    for (var i = 0; i < cars.length; i++) drawCar(ctx, cars[i]);
  }

  NB.Vehicles = {
    cars: cars, KINDS: KINDS,
    makeCar: makeCar, removeCar: removeCar, clear: clear,
    spawnTraffic: spawnTraffic, spawnParked: spawnParked,
    drive: drive, update: update, draw: draw,
    nearestStealable: nearestStealable,
    get list() { return cars; }
  };
})();
