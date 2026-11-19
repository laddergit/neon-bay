'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var peds = [];
  var SHIRTS = ['#e8e8e8', '#ff9d5c', '#7ec8ff', '#ffd24d', '#c86bff', '#7cff9e', '#ff7a7a', '#5cffd1'];
  var SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

  function spawn(n, cx, cy) {
    for (var i = 0; i < n; i++) {
      var x, y, tries = 0;
      do {
        x = cx + (Math.random() - 0.5) * 1600;
        y = cy + (Math.random() - 0.5) * 1600;
        tries++;
      } while (tries < 20 && (NB.City.solidAt(x, y, 12) || NB.City.onRoad(x, y)));
      if (tries >= 20) continue;
      peds.push({
        x: x, y: y, angle: Math.random() * Math.PI * 2,
        speed: 28 + Math.random() * 26, state: 'walk',
        shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
        skin: SKINS[Math.floor(Math.random() * SKINS.length)],
        target: null, fleeT: 0, downT: 0, step: Math.random() * 10
      });
    }
  }

  function clear() { peds.length = 0; }

  function pickSidewalkTarget(p) {
    // walk along a sidewalk: pick a point on a nearby road's edge and head there
    var rc = NB.City.nearestRoadCenter(p.x, p.y);
    var off = (Math.random() < 0.5 ? -52 : 52);
    var tx, ty;
    if (rc.vertical) { tx = rc.coord + off; ty = p.y + (Math.random() - 0.5) * 700; }
    else { tx = p.x + (Math.random() - 0.5) * 700; ty = rc.coord + off; }
    return { x: tx, y: ty };
  }

  function update(dt, threats) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      p.step += dt * 8;
      if (p.state === 'down') {
        p.downT -= dt;
        if (p.downT <= 0) { p.state = 'flee'; p.fleeT = 4; }
        continue;
      }
      // check threats: speeding cars, gunfire, the player running at them
      var fx = 0, fy = 0, scared = false;
      for (var t = 0; t < threats.length; t++) {
        var th = threats[t];
        var dx = p.x - th.x, dy = p.y - th.y;
        var d = Math.hypot(dx, dy);
        if (d < th.r && d > 1) {
          fx += dx / d; fy += dy / d; scared = true;
        }
      }
      if (scared) { p.state = 'flee'; p.fleeT = 3; }
      if (p.state === 'flee') {
        p.fleeT -= dt;
        var len = Math.hypot(fx, fy) || 1;
        var sp = 150;
        p.x += fx / len * sp * dt;
        p.y += fy / len * sp * dt;
        p.angle = Math.atan2(fy, fx);
        NB.City.resolveCircle(p, 10);
        if (p.fleeT <= 0) p.state = 'walk';
        continue;
      }
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 24) {
        p.target = pickSidewalkTarget(p);
      }
      var dx2 = p.target.x - p.x, dy2 = p.target.y - p.y;
      var d2 = Math.hypot(dx2, dy2);
      if (d2 > 1) {
        p.x += dx2 / d2 * p.speed * dt;
        p.y += dy2 / d2 * p.speed * dt;
        p.angle = Math.atan2(dy2, dx2);
      }
      NB.City.resolveCircle(p, 10);
    }
    // keep the sidewalks populated near the camera
    if (peds.length < 14 && NB.Game && NB.Game.camera) {
      spawn(14 - peds.length, NB.Game.camera.x, NB.Game.camera.y);
    }
  }

  // Knock down pedestrians in a radius (car hits). Returns how many went down.
  function knock(x, y, r, dirAngle, power) {
    var count = 0;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      var d = Math.hypot(p.x - x, p.y - y);
      if (d < r) {
        p.state = 'down';
        p.downT = 6 + Math.random() * 4;
        p.x += Math.cos(dirAngle) * power;
        p.y += Math.sin(dirAngle) * power;
        count++;
      }
    }
    return count;
  }

  function nearest(x, y, maxD) {
    var best = null, bestD = maxD;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      var d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function draw(ctx) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.state === 'down') {
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillStyle = p.shirt;
        ctx.fillRect(-5, -13, 10, 26);
        ctx.fillStyle = p.skin;
        ctx.beginPath(); ctx.arc(0, -16, 6, 0, Math.PI * 2); ctx.fill();
      } else {
        var bob = Math.sin(p.step) * 1.5;
        ctx.rotate(p.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(0, 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22222e';
        ctx.fillRect(-4, -6 + bob, 4, 12);
        ctx.fillRect(2, -6 - bob, 4, 12);
        ctx.fillStyle = p.shirt;
        ctx.fillRect(-6, -7, 12, 13);
        ctx.fillStyle = p.skin;
        ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  NB.Peds = {
    list: peds, spawn: spawn, clear: clear, update: update,
    knock: knock, nearest: nearest, draw: draw
  };
})();
