'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var index = 0;        // next mission to start (0..5, 6 = story done)
  var phase = 'idle';   // idle | active
  var current = null;   // runtime state of the active mission
  var bannerT = 0;

  function markerRing(ctx, x, y, color, pulse) {
    var r = 26 + Math.sin(pulse * 4) * 5;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 44 - Math.sin(pulse * 4) * 4);
    ctx.lineTo(x - 9, y - 58 - Math.sin(pulse * 4) * 4);
    ctx.lineTo(x + 9, y - 58 - Math.sin(pulse * 4) * 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  var defs = [
    {
      name: 'Hot Wheels',
      intro: 'A buyer wants a yellow Comet GT. Steal it and bring it to the garage at the docks.',
      reward: 500,
      setup: function () {
        var car = NB.Vehicles.makeCar('sports', 1050, 250, 0, 'parked');
        car.color = '#ffe600';
        return { targetCar: car, stage: 0 };
      },
      objective: function (s) {
        return s.stage === 0 ? 'Steal the yellow Comet GT (marked)' : 'Deliver the Comet to the garage at the docks';
      },
      marker: function (s) {
        if (s.stage === 0) return { x: s.targetCar.x, y: s.targetCar.y };
        return { x: NB.City.garage.x, y: NB.City.garage.y };
      },
      update: function (dt, s) {
        var pl = NB.Player.p;
        if (s.stage === 0 && pl.car === s.targetCar) {
          s.stage = 1;
          if (NB.HUD) NB.HUD.message('Nice wheels. Now lose the heat and deliver it!');
        }
        if (s.stage === 1 && pl.car === s.targetCar &&
            Math.hypot(pl.x - NB.City.garage.x, pl.y - NB.City.garage.y) < 100) {
          return 'complete';
        }
        return null;
      }
    },
    {
      name: 'Cross-Town Dash',
      intro: 'A package has to be across town in 90 seconds. Get in a car and floor it.',
      reward: 800,
      setup: function () { return { timer: 90, dest: { x: 2800, y: 2800 } }; },
      objective: function (s) {
        var pl = NB.Player.p;
        if (!pl.car) return 'Get in a car first!';
        return 'Deliver the package to the south-east corner — ' + Math.ceil(s.timer) + 's left';
      },
      marker: function (s) { return s.dest; },
      update: function (dt, s) {
        var pl = NB.Player.p;
        if (!pl.car) return null;
        s.timer -= dt;
        if (s.timer <= 0) return 'failed';
        if (Math.hypot(pl.x - s.dest.x, pl.y - s.dest.y) < 110) return 'complete';
        return null;
      }
    },
    {
      name: 'Dragnet',
      intro: 'The whole department is on you. Survive the dragnet for 60 seconds, then slip back to the safehouse.',
      reward: 1000,
      setup: function () {
        NB.Police.setWanted(3);
        return { timer: 60, stage: 0 };
      },
      objective: function (s) {
        if (s.stage === 0) return 'Survive the dragnet — ' + Math.ceil(s.timer) + 's';
        return 'You shook them for now — get back to the safehouse';
      },
      marker: function (s) {
        if (s.stage === 0) return null;
        return { x: NB.City.safehouse.x, y: NB.City.safehouse.y };
      },
      update: function (dt, s) {
        var pl = NB.Player.p;
        if (s.stage === 0) {
          s.timer -= dt;
          if (s.timer <= 0) {
            s.stage = 1;
            if (NB.HUD) NB.HUD.message('The dragnet is thinning — run for the safehouse!');
          }
        } else if (Math.hypot(pl.x - NB.City.safehouse.x, pl.y - NB.City.safehouse.y) < 100) {
          return 'complete';
        }
        return null;
      }
    },
    {
      name: 'The Pickup',
      intro: 'A package is waiting at the docks and the cops are already sniffing around. Grab it and take it to the park.',
      reward: 1200,
      setup: function () {
        NB.Police.setWanted(2);
        // the package waits on the road by the docks warehouses, not inside one
        return { stage: 0, docks: { x: 420, y: 2560 }, park: { x: 1600, y: 1960 } };
      },
      objective: function (s) {
        return s.stage === 0 ? 'Pick up the package at the docks' : 'Deliver the package to the park';
      },
      marker: function (s) { return s.stage === 0 ? s.docks : s.park; },
      update: function (dt, s) {
        var pl = NB.Player.p;
        if (s.stage === 0 && Math.hypot(pl.x - s.docks.x, pl.y - s.docks.y) < 80) {
          s.stage = 1;
          if (NB.HUD) NB.HUD.message('Package secured. Move!');
          NB.Audio.pickup();
        } else if (s.stage === 1 && Math.hypot(pl.x - s.park.x, pl.y - s.park.y) < 90) {
          return 'complete';
        }
        return null;
      }
    },
    {
      name: 'Hold the Block',
      intro: 'Rivals are coming for the safehouse. Three waves. Hold the block, Rex.',
      reward: 1500,
      setup: function () {
        return { wave: 0, attackers: [], spawnT: 1, betweenT: 0 };
      },
      objective: function (s) {
        return 'Defend the safehouse — wave ' + Math.max(1, s.wave) + ' of 3 (' + s.attackers.length + ' left)';
      },
      marker: function () { return { x: NB.City.safehouse.x, y: NB.City.safehouse.y }; },
      update: function (dt, s) {
        var pl = NB.Player.p;
        var sh = NB.City.safehouse;
        if (s.attackers.length === 0) {
          if (s.wave >= 3) return 'complete';
          s.betweenT -= dt;
          if (s.betweenT <= 0) {
            s.wave++;
            var count = s.wave === 1 ? 2 : s.wave === 2 ? 3 : 4;
            for (var i = 0; i < count; i++) {
              var a = Math.random() * Math.PI * 2;
              s.attackers.push({
                x: sh.x + Math.cos(a) * 320, y: sh.y + Math.sin(a) * 320,
                angle: 0, hp: 60, shootCd: 1 + Math.random(), step: 0
              });
            }
            if (NB.HUD) NB.HUD.message('Wave ' + s.wave + ' incoming!');
          }
          return null;
        }
        for (var j = s.attackers.length - 1; j >= 0; j--) {
          var at = s.attackers[j];
          at.step += dt * 8;
          var dx = pl.x - at.x, dy = pl.y - at.y;
          var d = Math.hypot(dx, dy);
          if (d > 240) {
            at.x += dx / d * 120 * dt;
            at.y += dy / d * 120 * dt;
          }
          at.angle = Math.atan2(dy, dx);
          NB.City.resolveCircle(at, 11);
          at.shootCd -= dt;
          if (at.shootCd <= 0 && d < 430 && d > 40) {
            at.shootCd = 1.3 + Math.random() * 0.7;
            if (NB.Game) NB.Game.spawnBullet(
              at.x + Math.cos(at.angle) * 18, at.y + Math.sin(at.angle) * 18,
              at.angle + (Math.random() - 0.5) * 0.16, 560, 'enemy', 8);
            NB.Audio.shot();
          }
          if (at.hp <= 0) {
            if (Math.random() < 0.6) NB.Player.dropPickup(at.x, at.y, 12);
            if (NB.Game) NB.Game.spawnParticles(at.x, at.y, 10, '#ff5a5a', 60);
            s.attackers.splice(j, 1);
          }
        }
        if (s.attackers.length === 0) s.betweenT = 2.5;
        return null;
      }
    },
    {
      name: 'The Big One',
      intro: 'The Bay Bank vault. Grab the cash, then run for the pier with the whole city on your tail.',
      reward: 5000,
      setup: function () { return { stage: 0, grabT: 0 }; },
      objective: function (s) {
        if (s.stage === 0) return 'Get to the Bay Bank downtown';
        if (s.stage === 1) return 'Grabbing the cash — stay put!';
        return 'Run! Escape to the end of the pier';
      },
      marker: function (s) {
        if (s.stage === 2) return { x: NB.City.pierEnd.x, y: NB.City.pierEnd.y };
        return { x: NB.City.bank.x, y: NB.City.bank.y };
      },
      update: function (dt, s) {
        var pl = NB.Player.p;
        if (s.stage === 0) {
          if (Math.hypot(pl.x - NB.City.bank.x, pl.y - NB.City.bank.y) < 90) {
            if (NB.HUD) NB.HUD.message('Press E to crack the vault');
          }
          return null;
        }
        if (s.stage === 1) {
          s.grabT -= dt;
          if (Math.hypot(pl.x - NB.City.bank.x, pl.y - NB.City.bank.y) > 120) {
            s.stage = 0;
            if (NB.HUD) NB.HUD.message('You stepped away — the vault is still shut');
            return null;
          }
          if (s.grabT <= 0) {
            s.stage = 2;
            NB.Police.setWanted(5);
            if (NB.HUD) NB.HUD.message('Cash grabbed! Every cop in the city is coming!');
            NB.Audio.jingle();
          }
          return null;
        }
        if (Math.hypot(pl.x - NB.City.pierEnd.x, pl.y - NB.City.pierEnd.y) < 90) return 'complete';
        return null;
      }
    }
  ];

  function start(i) {
    index = i;
    var def = defs[i];
    current = def.setup();
    phase = 'active';
    bannerT = 4;
    if (NB.HUD) NB.HUD.message(def.name + ': ' + def.intro, 5);
    if (NB.Game) NB.Game.onMissionStarted(def);
  }

  function fail() {
    if (phase !== 'active') return;
    phase = 'idle';
    current = null;
    if (NB.Game) NB.Game.onMissionFailed();
  }

  function update(dt) {
    if (phase === 'idle') {
      if (index < defs.length) {
        var pl = NB.Player.p;
        var sh = NB.City.safehouse;
        if (pl && pl.onFoot && Math.hypot(pl.x - sh.x, pl.y - sh.y) < 90) {
          start(index);
        }
      }
      return;
    }
    if (!current) return;
    var def = defs[index];
    var result = def.update(dt, current);
    if (result === 'complete') {
      phase = 'idle';
      current = null;
      var reward = def.reward;
      index++;
      if (NB.Game) NB.Game.onMissionComplete(def, reward);
    } else if (result === 'failed') {
      fail();
    }
    if (bannerT > 0) bannerT -= dt;
  }

  // E pressed: only the bank vault uses it right now
  function interact() {
    if (phase !== 'active' || !current) return false;
    var def = defs[index];
    if (def.name !== 'The Big One') return false;
    var pl = NB.Player.p;
    if (current.stage === 0 && Math.hypot(pl.x - NB.City.bank.x, pl.y - NB.City.bank.y) < 90) {
      current.stage = 1;
      current.grabT = 2;
      if (NB.HUD) NB.HUD.message('Cracking the vault...');
      return true;
    }
    return false;
  }

  function objectiveText() {
    if (phase === 'active' && current) return defs[index].objective(current);
    if (index >= defs.length) return 'Story complete — free roam Neon Bay';
    return 'Go to the safehouse (!) to start: ' + defs[index].name;
  }

  function markerPos() {
    if (phase === 'active' && current) return defs[index].marker(current);
    if (index < defs.length) return { x: NB.City.safehouse.x, y: NB.City.safehouse.y, start: true };
    return null;
  }

  function draw(ctx, t) {
    var m = markerPos();
    if (m) markerRing(ctx, m.x, m.y, m.start ? '#7cff00' : '#ffe600', t);
    // the mission-1 target car gets a ring of its own
    if (phase === 'active' && current && defs[index].name === 'Hot Wheels' && current.stage === 0) {
      markerRing(ctx, current.targetCar.x, current.targetCar.y, '#ffe600', t);
    }
    // attackers
    if (phase === 'active' && current && defs[index].name === 'Hold the Block') {
      for (var i = 0; i < current.attackers.length; i++) {
        var at = current.attackers[i];
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(at.angle);
        var bob = Math.sin(at.step) * 2;
        ctx.fillStyle = '#3a0d0d';
        ctx.fillRect(-5, -7 + bob, 5, 13);
        ctx.fillRect(-5, -6 - bob, 5, 13);
        ctx.fillStyle = '#5a1f1f';
        ctx.fillRect(-7, -8, 14, 16);
        ctx.fillStyle = '#e8b13c';
        ctx.fillRect(-7, -2, 14, 3);
        ctx.fillStyle = '#c68642';
        ctx.beginPath(); ctx.arc(9, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22222e';
        ctx.fillRect(10, -2, 14, 4);
        ctx.restore();
        // health bar
        ctx.fillStyle = '#111';
        ctx.fillRect(at.x - 14, at.y - 24, 28, 4);
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(at.x - 14, at.y - 24, 28 * Math.max(0, at.hp / 60), 4);
      }
    }
    // bank vault progress
    if (phase === 'active' && current && defs[index].name === 'The Big One' && current.stage === 1) {
      var bx = NB.City.bank.x, by = NB.City.bank.y;
      ctx.fillStyle = '#111';
      ctx.fillRect(bx - 40, by - 60, 80, 10);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bx - 40, by - 60, 80 * (1 - current.grabT / 2), 10);
    }
  }

  function reset() {
    index = 0; phase = 'idle'; current = null; bannerT = 0;
  }

  NB.Missions = {
    defs: defs,
    get index() { return index; },
    set index(v) { index = v; },
    get phase() { return phase; },
    get current() { return current; },
    start: start, fail: fail, update: update, interact: interact,
    objectiveText: objectiveText, markerPos: markerPos, draw: draw, reset: reset
  };
})();
