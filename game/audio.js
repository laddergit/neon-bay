'use strict';
(function () {
  var NB = window.NB || (window.NB = {});

  var ctx = null;
  var master = null;
  var muted = false;
  var engineOsc = null, engineOsc2 = null, engineGain = null;
  var sirenOsc = null, sirenGain = null, sirenLfo = null;
  var skidSrc = null, skidGain = null, skidFilter = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) {}
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = cutoff || 1200;
      var g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) {}
  }

  function engineStart() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 110;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      engineOsc.connect(f); engineOsc2.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
    } catch (e) {}
  }

  function engineSet(ratio, on) {
    if (!engineOsc) return;
    try {
      var t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + ratio * 0.06 : 0.0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + ratio * 130, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(100 + ratio * 260, t, 0.08);
    } catch (e) {}
  }

  function sirenStart() {
    if (!ensure() || sirenOsc) return;
    try {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.55;
      var lg = ctx.createGain(); lg.gain.value = 220;
      sirenLfo.connect(lg); lg.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.035;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    } catch (e) {}
  }

  function sirenStop() {
    if (!sirenOsc) return;
    try { sirenOsc.stop(); sirenLfo.stop(); } catch (e) {}
    sirenOsc = null; sirenLfo = null; sirenGain = null;
  }

  function skidStart() {
    if (!ensure() || skidSrc) return;
    try {
      var len = ctx.sampleRate;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      skidSrc = ctx.createBufferSource();
      skidSrc.buffer = buf; skidSrc.loop = true;
      skidFilter = ctx.createBiquadFilter(); skidFilter.type = 'bandpass'; skidFilter.frequency.value = 900; skidFilter.Q.value = 1.2;
      skidGain = ctx.createGain(); skidGain.gain.value = 0.0;
      skidSrc.connect(skidFilter); skidFilter.connect(skidGain); skidGain.connect(master);
      skidSrc.start();
    } catch (e) {}
  }

  function skidSet(level) {
    if (!skidGain) return;
    try { skidGain.gain.setTargetAtTime(Math.max(0, Math.min(0.12, level)), ctx.currentTime, 0.05); } catch (e) {}
  }

  NB.Audio = {
    init: ensure,
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      if (master) { try { master.gain.value = muted ? 0 : 0.5; } catch (e) {} }
      return muted;
    },
    shot: function () { noiseBurst(0.14, 0.5, 2600); tone(160, 0.1, 'square', 0.25, 60); },
    punch: function () { noiseBurst(0.08, 0.3, 500); },
    crash: function (s) { noiseBurst(0.25, Math.min(0.6, 0.2 + s * 0.4), 700); tone(90, 0.2, 'sine', 0.3, 40); },
    pickup: function () { tone(660, 0.09, 'sine', 0.25); setTimeout(function () { tone(880, 0.12, 'sine', 0.25); }, 90); },
    blip: function () { tone(520, 0.07, 'sine', 0.2); },
    jingle: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 'triangle', 0.25); }, i * 110); });
    },
    fail: function () { tone(220, 0.3, 'sawtooth', 0.2, 110); setTimeout(function () { tone(165, 0.4, 'sawtooth', 0.2, 90); }, 220); },
    click: function () { tone(800, 0.05, 'square', 0.15); },
    siren: function () { tone(720, 0.3, 'triangle', 0.12, 950); },
    engineStart: engineStart,
    engineSet: engineSet,
    sirenStart: sirenStart,
    sirenStop: sirenStop,
    skidStart: skidStart,
    skidSet: skidSet
  };
})();
