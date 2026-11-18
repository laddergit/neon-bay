// Neon Bay — every sound is synthesized with WebAudio, so the game ships
// no audio files and makes no network request. The context is created on
// the first user gesture (browsers demand that) and everything after that
// is a short oscillator or filtered-noise envelope.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    sirenOsc: null,
    engineOsc: null,
    engineGain: null,
    musicStep: 0,
    musicNext: 0,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch (e) {
      audio.ctx = null;
    }
  };

  audio.setMuted = function setMuted(m) {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  function tone(freqA, freqB, dur, type, gain) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, filterFreq, gain) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
  }

  audio.shoot = function shoot() {
    tone(880, 170, 0.09, 'square', 0.12);
    noise(0.05, 3200, 0.06);
  };
  audio.enemyShoot = function enemyShoot() {
    tone(420, 140, 0.1, 'square', 0.07);
  };
  audio.punch = function punch() {
    noise(0.08, 900, 0.14);
  };
  audio.explosion = function explosion() {
    noise(0.7, 900, 0.35);
    tone(130, 32, 0.6, 'sine', 0.3);
  };
  audio.pickup = function pickup() {
    tone(660, 660, 0.09, 'sine', 0.14);
    setTimeout(() => tone(990, 990, 0.12, 'sine', 0.14), 70);
  };
  audio.cash = function cash() {
    tone(880, 880, 0.08, 'sine', 0.12);
    setTimeout(() => tone(1174, 1174, 0.14, 'sine', 0.12), 80);
  };
  audio.click = function click() {
    tone(520, 520, 0.05, 'sine', 0.1);
  };
  audio.busted = function busted() {
    tone(392, 392, 0.18, 'triangle', 0.16);
    setTimeout(() => tone(311, 311, 0.3, 'triangle', 0.16), 180);
  };

  // Two-tone police siren. The game calls setSiren every frame; the
  // oscillator is created once and its pitch flips on a timer.
  audio.setSiren = function setSiren(active, t) {
    if (!audio.ctx || audio.muted) {
      if (audio.sirenOsc) {
        try { audio.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        audio.sirenOsc = null;
      }
      return;
    }
    if (!active) {
      if (audio.sirenOsc) {
        try { audio.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        audio.sirenOsc = null;
      }
      return;
    }
    if (!audio.sirenOsc) {
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = 'triangle';
      g.gain.value = 0.045;
      osc.connect(g);
      g.connect(audio.master);
      osc.start();
      audio.sirenOsc = osc;
    }
    const freq = Math.floor(t / 0.45) % 2 === 0 ? 740 : 990;
    audio.sirenOsc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.05);
  };

  // Engine hum: a sawtooth whose pitch follows speed. Silent on foot.
  audio.setEngine = function setEngine(speed01) {
    if (!audio.ctx || audio.muted || speed01 <= 0.02) {
      if (audio.engineOsc) {
        try { audio.engineOsc.stop(); } catch (e) { /* already stopped */ }
        audio.engineOsc = null;
        audio.engineGain = null;
      }
      return;
    }
    if (!audio.engineOsc) {
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      const filter = audio.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      g.gain.value = 0.02;
      osc.connect(filter);
      filter.connect(g);
      g.connect(audio.master);
      osc.start();
      audio.engineOsc = osc;
      audio.engineGain = g;
    }
    audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 150, audio.ctx.currentTime, 0.08);
    audio.engineGain.gain.setTargetAtTime(0.015 + speed01 * 0.03, audio.ctx.currentTime, 0.1);
  };

  // Procedural music: a slow bass line over Am–F–C–G with a hat tick and
  // an occasional lead pluck. Driven by the game's clock, not timers.
  audio.musicTick = function musicTick(t) {
    if (!audio.ctx || audio.muted) return;
    if (t < audio.musicNext) return;
    const stepDur = 0.24;
    audio.musicNext = t + stepDur;
    const roots = [55, 43.65, 65.41, 49]; // A2 F2 C3 G2
    const bar = Math.floor(audio.musicStep / 8) % 4;
    const step = audio.musicStep % 8;
    if (step === 0 || step === 4) {
      tone(roots[bar], roots[bar], 0.5, 'triangle', 0.1);
    }
    if (step % 2 === 1) noise(0.03, 6000, 0.03);
    if (audio.musicStep % 16 === 10) {
      tone(440 * (bar === 1 ? 0.89 : 1), 440, 0.3, 'sine', 0.05);
    }
    audio.musicStep++;
  };

  return audio;
}
