// Synthesised sound: no audio files, everything is WebAudio. The context is
// created on the first user gesture (browsers block audio before that), and
// every effect guards itself so a missing context never breaks the game.
export function createSound() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch { /* sound is decoration */ }
  }

  function noise(dur, vol, low) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = low || 1200;
      const g = c.createGain();
      g.gain.value = vol || 0.2;
      src.connect(f).connect(g).connect(c.destination);
      src.start();
    } catch { /* sound is decoration */ }
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.06); },
    punch() { noise(0.12, 0.25, 500); tone(140, 0.12, 'sine', 0.18, 70); },
    shot() { noise(0.14, 0.3, 2400); tone(220, 0.1, 'square', 0.1, 60); },
    crash() { noise(0.3, 0.3, 400); },
    pickup() { tone(880, 0.09, 'sine', 0.12); setTimeout(() => tone(1320, 0.12, 'sine', 0.12), 80); },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.14), i * 110));
    },
    engine(speed, driving) {
      if (muted) { this.stopEngine(); return; }
      const c = ensure();
      if (!c || !driving) { this.stopEngine(); return; }
      try {
        if (!engineOsc) {
          engineOsc = c.createOscillator();
          engineGain = c.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0.03;
          engineOsc.connect(engineGain).connect(c.destination);
          engineOsc.start();
        }
        engineOsc.frequency.value = 60 + Math.abs(speed) * 0.22;
        engineGain.gain.value = 0.02 + Math.min(0.05, Math.abs(speed) * 0.00006);
      } catch { /* sound is decoration */ }
    },
    stopEngine() {
      try { if (engineOsc) { engineOsc.stop(); engineOsc = null; engineGain = null; } } catch { /* already stopped */ }
    },
    siren(on) {
      if (muted || !on) {
        try { if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; sirenGain = null; } } catch { /* already stopped */ }
        return;
      }
      const c = ensure();
      if (!c) return;
      try {
        if (!sirenOsc) {
          sirenOsc = c.createOscillator();
          sirenGain = c.createGain();
          sirenOsc.type = 'sine';
          sirenOsc.frequency.value = 700;
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain).connect(c.destination);
          sirenOsc.start();
          const lfo = c.createOscillator();
          lfo.frequency.value = 0.8;
          const lg = c.createGain();
          lg.gain.value = 250;
          lfo.connect(lg).connect(sirenOsc.frequency);
          lfo.start();
        }
      } catch { /* sound is decoration */ }
    },
  };
}
