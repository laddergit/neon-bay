'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var WORLD = 3200;
  var ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  var ROAD_W = 80;
  var WATER_Y = 3120;
  var BEACH_Y = 3050;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var SIGN_WORDS = ['HOTEL', 'CASINO', 'BAR', 'NEON', '24H', 'PIZZA', 'CLUB', 'MOTEL', 'DANCE', 'TACOS', 'BAY', 'REX', '777', 'NOODLE', 'GYM', 'VEGA'];
  var NEON_COLORS = ['#ff2d78', '#00e5ff', '#ffe600', '#7cff00', '#ff7a00', '#c86bff', '#ff3860'];
  var TOWER_WALLS = ['#2a2f45', '#333a55', '#232838', '#3a2f4d', '#26344a'];
  var HOUSE_WALLS = ['#c96f4a', '#7a9e7e', '#d9b380', '#8a7fbf', '#b5533c', '#5f8a8b'];
  var WARE_WALLS = ['#6b5d4f', '#5d6b73', '#71604a', '#4f5d6b'];

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  var buildings = [];
  var trees = [];
  var lamps = [];

  function districtOf(x, y) {
    if (y >= BEACH_Y) return 'beach';
    if (x < 1000 && y >= 2200) return 'docks';
    if (x >= 1000 && x < 2200 && y >= 600 && y < 1800) return 'downtown';
    if (x >= 1400 && x < 1800 && y >= 1800 && y < 2200) return 'park';
    return 'suburbs';
  }

  function build() {
    var rng = mulberry32(1337);
    // clear in place: NB.City.buildings / trees keep pointing at these arrays
    buildings.length = 0;
    trees.length = 0;
    lamps.length = 0;
    var xs = [[0, 160], [240, 560], [640, 960], [1040, 1360], [1440, 1760], [1840, 2160], [2240, 2560], [2640, 2960], [3040, 3200]];
    var ys = xs.slice();
    for (var bi = 0; bi < xs.length; bi++) {
      for (var bj = 0; bj < ys.length; bj++) {
        var x0 = xs[bi][0], x1 = xs[bi][1], y0 = ys[bj][0], y1 = ys[bj][1];
        if (y0 >= 3040) continue; // beach and water, no buildings
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var d = districtOf(cx, cy);
        if (d === 'park') {
          for (var t = 0; t < 16; t++) {
            trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40), r: 14 + rng() * 12 });
          }
          continue;
        }
        if (d === 'downtown') {
          var bw = 150 + rng() * 90, bh = 150 + rng() * 90;
          buildings.push({
            x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh,
            color: pick(rng, TOWER_WALLS), roof: '#171a26', kind: 'tower',
            sign: pick(rng, SIGN_WORDS), signColor: pick(rng, NEON_COLORS),
            hgt: 26 + rng() * 30
          });
          if (rng() < 0.5) {
            var sw = 70 + rng() * 50, sh = 60 + rng() * 40;
            buildings.push({
              x: x0 + 24 + rng() * 40, y: y1 - sh - 24, w: sw, h: sh,
              color: pick(rng, TOWER_WALLS), roof: '#171a26', kind: 'shop',
              sign: rng() < 0.7 ? pick(rng, SIGN_WORDS) : null, signColor: pick(rng, NEON_COLORS), hgt: 8
            });
          }
        } else if (d === 'docks') {
          var ww = 180 + rng() * 80, wh = 120 + rng() * 60;
          buildings.push({
            x: cx - ww / 2, y: cy - wh / 2, w: ww, h: wh,
            color: pick(rng, WARE_WALLS), roof: '#3a3230', kind: 'warehouse',
            sign: rng() < 0.5 ? 'DOCKS' : null, signColor: '#ffb347', hgt: 12
          });
        } else {
          var n = 2 + Math.floor(rng() * 3);
          for (var h = 0; h < n; h++) {
            var hw = 60 + rng() * 50, hh = 55 + rng() * 45;
            var hx = x0 + 18 + rng() * Math.max(1, (x1 - x0 - 36 - hw));
            var hy = y0 + 18 + rng() * Math.max(1, (y1 - y0 - 36 - hh));
            buildings.push({
              x: hx, y: hy, w: hw, h: hh,
              color: pick(rng, HOUSE_WALLS), roof: '#2e2118', kind: 'house',
              sign: null, signColor: null, hgt: 6 + rng() * 4
            });
            if (rng() < 0.6) trees.push({ x: hx + hw / 2 + (rng() - 0.5) * 90, y: hy + hh / 2 + (rng() - 0.5) * 90, r: 10 + rng() * 8 });
          }
        }
      }
    }
    // street lamps along the roads
    for (var i = 0; i < ROADS.length; i++) {
      for (var j = 0; j < ROADS.length; j++) {
        lamps.push({ x: ROADS[i] + 52, y: ROADS[j] + 52 });
      }
    }
  }

  function onRoad(x, y) {
    for (var i = 0; i < ROADS.length; i++) {
      if (Math.abs(x - ROADS[i]) <= ROAD_W / 2) return true;
      if (Math.abs(y - ROADS[i]) <= ROAD_W / 2) return true;
    }
    return false;
  }

  function inWater(x, y) { return y >= WATER_Y; }

  function rectHit(b, x, y, r) {
    var cx = Math.max(b.x, Math.min(x, b.x + b.w));
    var cy = Math.max(b.y, Math.min(y, b.y + b.h));
    var dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy < r * r;
  }

  function solidAt(x, y, r) {
    if (x < r || y < r || x > WORLD - r || y > WORLD - r) return true;
    // the pier (x 1560-1640) crosses the water: it is solid ground, not water
    if (y + r >= WATER_Y && !(x >= 1560 && x <= 1640 && y >= BEACH_Y)) return true;
    for (var i = 0; i < buildings.length; i++) {
      if (rectHit(buildings[i], x, y, r)) return true;
    }
    return false;
  }

  // Push a circle entity out of buildings, water and the map edge. Returns true on hit.
  function resolveCircle(e, r) {
    var hit = false;
    if (e.x < r) { e.x = r; hit = true; }
    if (e.y < r) { e.y = r; hit = true; }
    if (e.x > WORLD - r) { e.x = WORLD - r; hit = true; }
    if (e.y > WORLD - r) { e.y = WORLD - r; hit = true; }
    // the pier crosses the water: on it you can walk to its end, but not off its sides
    var onPier = e.x >= 1560 && e.x <= 1640 && e.y >= BEACH_Y;
    if (e.y + r > WATER_Y && !onPier) { e.y = WATER_Y - r; hit = true; }
    if (onPier && e.y + r > WATER_Y) {
      if (e.x < 1560 + r) { e.x = 1560 + r; hit = true; }
      if (e.x > 1640 - r) { e.x = 1640 - r; hit = true; }
    }
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (!rectHit(b, e.x, e.y, r)) continue;
      var cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
      var cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
      var dx = e.x - cx, dy = e.y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        // centre inside the rect: push out along the smallest penetration axis
        var left = e.x - b.x, right = b.x + b.w - e.x, top = e.y - b.y, bot = b.y + b.h - e.y;
        var m = Math.min(left, right, top, bot);
        if (m === left) e.x = b.x - r;
        else if (m === right) e.x = b.x + b.w + r;
        else if (m === top) e.y = b.y - r;
        else e.y = b.y + b.h + r;
      } else {
        var d = Math.sqrt(d2);
        e.x = cx + dx / d * r;
        e.y = cy + dy / d * r;
      }
      hit = true;
    }
    return hit;
  }

  function nearestRoadCenter(x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < ROADS.length; i++) {
      var c = ROADS[i];
      var d = Math.abs(x - c);
      if (d < bestD) { bestD = d; best = { x: c, y: y, vertical: true, coord: c }; }
      d = Math.abs(y - c);
      if (d < bestD) { bestD = d; best = { x: x, y: c, vertical: false, coord: c }; }
    }
    return best;
  }

  function roadAt(x, y) {
    for (var i = 0; i < ROADS.length; i++) {
      if (Math.abs(x - ROADS[i]) <= ROAD_W / 2) return { vertical: true, coord: ROADS[i] };
      if (Math.abs(y - ROADS[i]) <= ROAD_W / 2) return { vertical: false, coord: ROADS[i] };
    }
    return null;
  }

  function draw(ctx, cam) {
    var vx0 = cam.x - cam.w / 2 - 60, vy0 = cam.y - cam.h / 2 - 60;
    var vx1 = cam.x + cam.w / 2 + 60, vy1 = cam.y + cam.h / 2 + 60;
    // ground
    ctx.fillStyle = '#161624';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // water
    ctx.fillStyle = '#0b2a4a';
    ctx.fillRect(vx0, Math.max(vy0, WATER_Y), vx1 - vx0, vy1 - Math.max(vy0, WATER_Y));
    ctx.fillStyle = '#0e3a63';
    ctx.fillRect(vx0, Math.max(vy0, WATER_Y), vx1 - vx0, 6);
    // beach
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(vx0, Math.max(vy0, BEACH_Y), vx1 - vx0, Math.min(vy1, WATER_Y) - Math.max(vy0, BEACH_Y));
    // park grass
    ctx.fillStyle = '#1d4028';
    ctx.fillRect(1440, 1800, 320, 320);
    ctx.fillStyle = '#265231';
    ctx.beginPath(); ctx.arc(1600, 1960, 46, 0, Math.PI * 2); ctx.fill();
    // roads
    ctx.fillStyle = '#23232e';
    for (var i = 0; i < ROADS.length; i++) {
      var c = ROADS[i];
      ctx.fillRect(vx0, c - ROAD_W / 2, vx1 - vx0, ROAD_W);
      ctx.fillRect(c - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
    }
    // sidewalks
    ctx.fillStyle = '#2e2e3d';
    for (var j = 0; j < ROADS.length; j++) {
      var cc = ROADS[j];
      ctx.fillRect(vx0, cc - ROAD_W / 2 - 10, vx1 - vx0, 10);
      ctx.fillRect(vx0, cc + ROAD_W / 2, vx1 - vx0, 10);
      ctx.fillRect(cc - ROAD_W / 2 - 10, vy0, 10, vy1 - vy0);
      ctx.fillRect(cc + ROAD_W / 2, vy0, 10, vy1 - vy0);
    }
    // centre dashes
    ctx.fillStyle = '#c8c85a';
    for (var k = 0; k < ROADS.length; k++) {
      var rc = ROADS[k];
      for (var d = 0; d < WORLD; d += 64) {
        if (d % 320 < 200) ctx.fillRect(d, rc - 2, 34, 4);
        if (d % 320 < 200) ctx.fillRect(rc - 2, d, 4, 34);
      }
    }
    // crosswalks at intersections
    ctx.fillStyle = '#d8d8e0';
    for (var a = 0; a < ROADS.length; a++) {
      for (var b = 0; b < ROADS.length; b++) {
        var ix = ROADS[a], iy = ROADS[b];
        for (var s = -30; s <= 30; s += 15) {
          ctx.fillRect(ix + s - 4, iy - ROAD_W / 2 - 8, 8, 12);
          ctx.fillRect(ix + s - 4, iy + ROAD_W / 2 - 4, 8, 12);
        }
      }
    }
    // pier
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(1560, BEACH_Y, 80, WORLD - BEACH_Y);
    ctx.fillStyle = '#8f6f45';
    for (var p = BEACH_Y; p < WORLD; p += 26) ctx.fillRect(1560, p, 80, 3);
    // trees
    for (var t = 0; t < trees.length; t++) {
      var tr = trees[t];
      if (tr.x < vx0 || tr.x > vx1 || tr.y < vy0 || tr.y > vy1) continue;
      ctx.fillStyle = '#14301c';
      ctx.beginPath(); ctx.arc(tr.x + 3, tr.y + 4, tr.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f7a3e';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f9a4e';
      ctx.beginPath(); ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.3, tr.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // buildings
    for (var bi = 0; bi < buildings.length; bi++) {
      var bd = buildings[bi];
      if (bd.x + bd.w < vx0 || bd.x > vx1 || bd.y + bd.h < vy0 || bd.y > vy1) continue;
      // drop shadow for height
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bd.x + bd.hgt * 0.4, bd.y + bd.hgt * 0.5, bd.w, bd.h);
      ctx.fillStyle = bd.color;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.fillStyle = bd.roof;
      ctx.fillRect(bd.x + 5, bd.y + 5, bd.w - 10, bd.h - 10);
      if (bd.kind === 'tower') {
        ctx.fillStyle = 'rgba(255,230,120,0.85)';
        for (var wy = bd.y + 16; wy < bd.y + bd.h - 12; wy += 22) {
          for (var wx = bd.x + 14; wx < bd.x + bd.w - 12; wx += 26) {
            if (((wx * 7 + wy * 13) % 5) < 3) ctx.fillRect(wx, wy, 10, 12);
          }
        }
      } else if (bd.kind === 'house') {
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(bd.x + bd.w / 2 - 9, bd.y + bd.h - 20, 18, 20);
        ctx.fillStyle = 'rgba(255,230,120,0.9)';
        ctx.fillRect(bd.x + 10, bd.y + 12, 12, 12);
        ctx.fillRect(bd.x + bd.w - 22, bd.y + 12, 12, 12);
      }
      if (bd.sign) {
        ctx.save();
        ctx.font = 'bold ' + Math.max(13, Math.min(22, bd.w / (bd.sign.length * 0.75))) + 'px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = bd.signColor;
        ctx.shadowBlur = 14;
        ctx.fillStyle = bd.signColor;
        ctx.fillText(bd.sign, bd.x + bd.w / 2, bd.y + bd.h / 2);
        ctx.restore();
      }
    }
    // district labels
    ctx.save();
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillText('DOWNTOWN', 1600, 420);
    ctx.fillText('DOCKS', 500, 2400);
    ctx.fillText('SUBURBS', 2600, 2600);
    ctx.fillText('NEON BAY', 1600, 3170);
    ctx.restore();
  }

  NB.City = {
    WORLD: WORLD, ROADS: ROADS, ROAD_W: ROAD_W, WATER_Y: WATER_Y, BEACH_Y: BEACH_Y,
    buildings: buildings, trees: trees,
    safehouse: { x: 760, y: 2520 },
    bank: { x: 1600, y: 1380 },
    garage: { x: 420, y: 2680 },
    pierEnd: { x: 1600, y: 3160 },
    build: build, onRoad: onRoad, inWater: inWater, solidAt: solidAt,
    resolveCircle: resolveCircle, nearestRoadCenter: nearestRoadCenter, roadAt: roadAt,
    draw: draw, districtOf: districtOf
  };
})();
