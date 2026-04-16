// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  ChiptuneEngine.js — 8-channel NES-style chiptune synth + SFX engine      ║
// ║  Pure Web Audio API, zero dependencies, production-ready                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Note frequency table (C0–B8) ─────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const _noteCache = {};
function noteToFreq(note) {
  if (typeof note === 'number') return note;
  if (_noteCache[note] !== undefined) return _noteCache[note];
  if (note === '__' || note === '..') return 0; // rest
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return 0;
  const semi = NOTE_NAMES.indexOf(m[1]);
  const oct = parseInt(m[2]);
  const freq = 440 * Math.pow(2, (semi - 9) / 12 + (oct - 4));
  _noteCache[note] = freq;
  return freq;
}

// ── ADSR envelope ────────────────────────────────────────────────────────────
// All times in seconds. sustain is a level (0–1).
const DEFAULT_ENV = { a: 0.005, d: 0.08, s: 0.6, r: 0.06 };

function applyADSR(gainNode, env, startTime, duration, volume) {
  const g = gainNode.gain;
  const { a, d, s, r } = env;
  const peak = volume;
  const sustainLevel = peak * s;
  const releaseStart = startTime + duration;

  g.setValueAtTime(0, startTime);
  g.linearRampToValueAtTime(peak, startTime + a);
  g.linearRampToValueAtTime(sustainLevel, startTime + a + d);
  g.setValueAtTime(sustainLevel, releaseStart);
  g.linearRampToValueAtTime(0, releaseStart + r);
}

// ── Variable duty-cycle square wave via PeriodicWave ─────────────────────────
const _dutyWaveCache = new Map();
function getDutyWave(ctx, duty = 0.5) {
  const key = `${ctx._id}_${duty}`;
  if (_dutyWaveCache.has(key)) return _dutyWaveCache.get(key);
  const N = 64;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  real[0] = 2 * duty - 1;
  for (let n = 1; n < N; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * duty * Math.PI * 2);
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  _dutyWaveCache.set(key, wave);
  return wave;
}

// ── Noise buffer (cached) ────────────────────────────────────────────────────
let _noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (_noiseBuffer && _noiseBuffer.sampleRate === ctx.sampleRate) return _noiseBuffer;
  const len = ctx.sampleRate * 2; // 2 seconds
  _noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = _noiseBuffer.getChannelData(0);
  // LFSR-style periodic noise for that NES crunch
  let lfsr = 0x7FFF;
  for (let i = 0; i < len; i++) {
    const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
    lfsr = (lfsr >> 1) | (bit << 14);
    data[i] = (lfsr & 1) ? 1 : -1;
  }
  return _noiseBuffer;
}

// ── Channel voice types ──────────────────────────────────────────────────────
const VOICE_TYPES = {
  square50:  { type: 'square' },
  square25:  { type: 'custom', duty: 0.25 },
  square125: { type: 'custom', duty: 0.125 },
  triangle:  { type: 'triangle' },
  sawtooth:  { type: 'sawtooth' },
  sine:      { type: 'sine' },
  noise:     { type: 'noise' },
  pulse75:   { type: 'custom', duty: 0.75 },
};

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Channel — a single voice with oscillator + gain + effects                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
class Channel {
  constructor(ctx, dest, id) {
    this._ctx = ctx;
    this._id = id;
    this._gain = ctx.createGain();
    this._gain.gain.value = 0;
    this._gain.connect(dest);
    this._osc = null;
    this._voice = 'square50';
    this._env = { ...DEFAULT_ENV };
    this._volume = 0.5;
    this._scheduledNodes = [];
    this._pitchBend = 0; // semitones
    this._vibratoSpeed = 0;
    this._vibratoDepth = 0;
    this._lfo = null;
    this._lfoGain = null;
  }

  setVoice(voice) { this._voice = voice; }
  setVolume(v) { this._volume = Math.max(0, Math.min(1, v)); }
  setEnvelope(env) { Object.assign(this._env, env); }
  setPitchBend(semitones) { this._pitchBend = semitones; }
  setVibrato(speed, depth) {
    this._vibratoSpeed = speed;
    this._vibratoDepth = depth;
  }

  // Schedule a note at an exact audioContext time
  playNote(freq, startTime, duration) {
    if (freq <= 0) return; // rest
    const ctx = this._ctx;
    const voiceDef = VOICE_TYPES[this._voice] || VOICE_TYPES.square50;

    // Apply pitch bend
    if (this._pitchBend) {
      freq *= Math.pow(2, this._pitchBend / 12);
    }

    const gain = ctx.createGain();
    gain.connect(this._gain);
    this._gain.gain.setValueAtTime(1, startTime);

    applyADSR(gain, this._env, startTime, duration, this._volume);
    const endTime = startTime + duration + this._env.r + 0.01;

    if (voiceDef.type === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      src.loop = true;
      // Use playback rate to change noise "pitch"
      src.playbackRate.value = Math.max(0.1, freq / 440);
      src.connect(gain);
      src.start(startTime);
      src.stop(endTime);
      this._scheduledNodes.push(src);
    } else {
      const osc = ctx.createOscillator();
      if (voiceDef.type === 'custom') {
        osc.setPeriodicWave(getDutyWave(ctx, voiceDef.duty));
      } else {
        osc.type = voiceDef.type;
      }
      osc.frequency.setValueAtTime(freq, startTime);

      // Vibrato via LFO
      if (this._vibratoSpeed > 0 && this._vibratoDepth > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = this._vibratoSpeed;
        lfoGain.gain.value = freq * this._vibratoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(startTime);
        lfo.stop(endTime);
        this._scheduledNodes.push(lfo);
      }

      osc.connect(gain);
      osc.start(startTime);
      osc.stop(endTime);
      this._scheduledNodes.push(osc);
    }

    this._scheduledNodes.push(gain);
  }

  // Cleanup finished nodes
  gc(now) {
    this._scheduledNodes = this._scheduledNodes.filter(n => {
      try {
        if (n.context && n.context.currentTime !== undefined) return true;
      } catch { /* already stopped */ }
      return true;
    });
  }

  stop() {
    for (const n of this._scheduledNodes) {
      try { n.stop(); } catch {}
      try { n.disconnect(); } catch {}
    }
    this._scheduledNodes = [];
    this._gain.gain.cancelScheduledValues(0);
    this._gain.gain.setValueAtTime(0, this._ctx.currentTime);
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Track — a sequence of notes/events for one channel                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// Pattern format:
// {
//   voice: 'square50',
//   envelope: { a, d, s, r },
//   volume: 0.5,
//   vibrato: [speed, depth],
//   notes: [
//     ['C4', 0.25],            // [note, duration in beats]
//     ['..', 0.5],             // rest
//     ['E4', 0.25, { v: 0.8 }] // per-note overrides
//   ]
// }

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SFX Presets — one-shot sound effects                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
const SFX_PRESETS = {
  coin: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(987.77, now);        // B5
    o.frequency.setValueAtTime(1318.51, now + 0.06); // E6
    g.gain.setValueAtTime(vol * 0.4, now);
    g.gain.setValueAtTime(vol * 0.4, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.2);
  },

  hit: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    // Noise burst
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 2;
    g.gain.setValueAtTime(vol * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(f).connect(g).connect(dest);
    src.start(now); src.stop(now + 0.1);
  },

  powerup: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(200, now);
    o.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
    g.gain.setValueAtTime(vol * 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.35);
  },

  select: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 660;
    g.gain.setValueAtTime(vol * 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.08);
  },

  error: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(200, now);
    o.frequency.setValueAtTime(150, now + 0.1);
    g.gain.setValueAtTime(vol * 0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.25);
  },

  explosion: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    // Low sine sweep
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, now);
    o.frequency.exponentialRampToValueAtTime(20, now + 0.3);
    g.gain.setValueAtTime(vol * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.4);
    // Noise layer
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.4, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(g2).connect(dest);
    src.start(now); src.stop(now + 0.5);
  },

  spin: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(300, now);
    o.frequency.exponentialRampToValueAtTime(800, now + 0.12);
    o.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    g.gain.setValueAtTime(vol * 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.25);
  },

  tick: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1200;
    g.gain.setValueAtTime(vol * 0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.03);
  },

  jackpot: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      const t = now + i * 0.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 0.25);
    });
  },

  gameover: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const notes = [392, 349.23, 311.13, 261.63]; // G4 F4 D#4 C4
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      const t = now + i * 0.2;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 0.4);
    });
  },

  kick: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, now);
    o.frequency.exponentialRampToValueAtTime(30, now + 0.1);
    g.gain.setValueAtTime(vol * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.15);
  },

  snare: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2000;
    g.gain.setValueAtTime(vol * 0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(f).connect(g).connect(dest);
    src.start(now); src.stop(now + 0.13);
    // Tonal body
    const o = ctx.createOscillator();
    const g2 = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    g2.gain.setValueAtTime(vol * 0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o.connect(g2).connect(dest);
    o.start(now); o.stop(now + 0.08);
  },

  hihat: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src.connect(f).connect(g).connect(dest);
    src.start(now); src.stop(now + 0.06);
  },

  laser: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1500, now);
    o.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    g.gain.setValueAtTime(vol * 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.2);
  },

  jump: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(300, now);
    o.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    o.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    g.gain.setValueAtTime(vol * 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.connect(g).connect(dest);
    o.start(now); o.stop(now + 0.18);
  },

  levelup: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    // Fast ascending arpeggio C5→E5→G5→C6→E6
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      const t = now + i * 0.06;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.25, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 0.15);
    });
  },

  purchase: (ctx, dest, vol) => {
    const now = ctx.currentTime;
    // Ka-ching: two tones
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'triangle';
    o1.frequency.value = 1500;
    g1.gain.setValueAtTime(vol * 0.2, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    o1.connect(g1).connect(dest);
    o1.start(now); o1.stop(now + 0.06);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'triangle';
    o2.frequency.value = 2500;
    g2.gain.setValueAtTime(0, now + 0.05);
    g2.gain.linearRampToValueAtTime(vol * 0.25, now + 0.055);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o2.connect(g2).connect(dest);
    o2.start(now + 0.05); o2.stop(now + 0.2);
  },
};

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  ChiptuneEngine — main API                                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
let _ctxId = 0;

export class ChiptuneEngine {
  /**
   * @param {AudioContext} [audioCtx] - optional existing AudioContext to reuse
   */
  constructor(audioCtx) {
    this._ctx = audioCtx || null;
    this._ready = false;
    this._channels = [];
    this._masterGain = null;
    this._bgmGain = null;
    this._sfxGain = null;
    this._compressor = null;

    // BGM state
    this._bgmPlaying = false;
    this._bgmSong = null;
    this._bgmBPM = 120;
    this._bgmNextBeat = 0;
    this._bgmPatternIdx = [];  // per-channel pattern index
    this._bgmLoopId = 0;
    this._bgmScheduleAhead = 0.15; // seconds to schedule ahead
    this._bgmLookahead = 25;      // ms between scheduler ticks

    // Volume levels
    this._masterVol = 0.5;
    this._bgmVol = 0.6;
    this._sfxVol = 0.8;

    this._muted = false;
    this._disposed = false;
  }

  // ── Initialization ────────────────────────────────────────────────────────
  init(existingCtx) {
    if (this._ready) return this;
    const ctx = existingCtx || this._ctx ||
      new (window.AudioContext || window.webkitAudioContext)();
    this._ctx = ctx;
    ctx._id = _ctxId++;

    // Master chain: channels → bgm/sfx gains → compressor → master → dest
    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -18;
    this._compressor.knee.value = 12;
    this._compressor.ratio.value = 4;
    this._compressor.attack.value = 0.003;
    this._compressor.release.value = 0.15;

    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = this._masterVol;
    this._compressor.connect(this._masterGain);
    this._masterGain.connect(ctx.destination);

    this._bgmGain = ctx.createGain();
    this._bgmGain.gain.value = this._bgmVol;
    this._bgmGain.connect(this._compressor);

    this._sfxGain = ctx.createGain();
    this._sfxGain.gain.value = this._sfxVol;
    this._sfxGain.connect(this._compressor);

    // Create 8 channels (0-7), all route to bgmGain by default
    for (let i = 0; i < 8; i++) {
      this._channels.push(new Channel(ctx, this._bgmGain, i));
    }

    this._ready = true;
    return this;
  }

  // ── Resume context (call on user gesture) ─────────────────────────────────
  async resume() {
    if (this._ctx && this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
  }

  // ── Volume controls ───────────────────────────────────────────────────────
  get masterVolume() { return this._masterVol; }
  set masterVolume(v) {
    this._masterVol = Math.max(0, Math.min(1, v));
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(
        this._muted ? 0 : this._masterVol, this._ctx.currentTime, 0.02
      );
    }
  }

  get bgmVolume() { return this._bgmVol; }
  set bgmVolume(v) {
    this._bgmVol = Math.max(0, Math.min(1, v));
    if (this._bgmGain) {
      this._bgmGain.gain.setTargetAtTime(this._bgmVol, this._ctx.currentTime, 0.02);
    }
  }

  get sfxVolume() { return this._sfxVol; }
  set sfxVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (this._sfxGain) {
      this._sfxGain.gain.setTargetAtTime(this._sfxVol, this._ctx.currentTime, 0.02);
    }
  }

  mute() {
    this._muted = true;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.02);
    }
  }

  unmute() {
    this._muted = false;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._masterVol, this._ctx.currentTime, 0.02);
    }
  }

  toggleMute() { this._muted ? this.unmute() : this.mute(); return !this._muted; }

  // ── SFX ───────────────────────────────────────────────────────────────────
  /**
   * Play a preset SFX or a custom one-shot function.
   * @param {string|Function} sfx - preset name or (ctx, dest, vol) => void
   * @param {number} [vol] - override volume (0–1)
   */
  sfx(sfx, vol) {
    if (!this._ready || this._muted) return;
    this.resume();
    const v = vol !== undefined ? vol : 1;
    if (typeof sfx === 'function') {
      sfx(this._ctx, this._sfxGain, v);
    } else if (SFX_PRESETS[sfx]) {
      SFX_PRESETS[sfx](this._ctx, this._sfxGain, v);
    }
  }

  /**
   * Play a raw tone (replaces intro.js _tone)
   */
  tone(freq, duration, type = 'square', vol = 0.06) {
    if (!this._ready || this._muted) return;
    this.resume();
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.connect(g).connect(this._sfxGain);
    o.start(now);
    o.stop(now + duration);
  }

  // ── BGM — song playback ───────────────────────────────────────────────────
  //
  // Song format:
  // {
  //   bpm: 140,
  //   swing: 0,         // 0–1, shuffle amount
  //   loop: true,
  //   channels: [
  //     {
  //       voice: 'square50',
  //       envelope: { a, d, s, r },
  //       volume: 0.4,
  //       vibrato: [6, 0.02],
  //       patterns: [
  //         [['C4',1], ['E4',1], ['G4',2]],  // pattern 0
  //         [['A4',1], ['B4',1], ['C5',2]],   // pattern 1
  //       ],
  //       sequence: [0, 0, 1, 0],  // play pattern 0, 0, 1, 0
  //     },
  //     // ... up to 8 channels
  //   ]
  // }

  /**
   * Start playing a song.
   * @param {object} song
   */
  playSong(song) {
    if (!this._ready) return;
    this.stopSong();
    this.resume();

    this._bgmSong = song;
    this._bgmBPM = song.bpm || 120;
    this._bgmPlaying = true;
    this._bgmNoteIdx = [];
    this._bgmSeqIdx = [];
    this._bgmChTime = [];  // per-channel time cursor

    const startTime = this._ctx.currentTime + 0.05;
    const chCount = Math.min(song.channels.length, 8);
    for (let i = 0; i < chCount; i++) {
      const ch = song.channels[i];
      const channel = this._channels[i];
      channel.setVoice(ch.voice || 'square50');
      if (ch.envelope) channel.setEnvelope(ch.envelope);
      channel.setVolume(ch.volume !== undefined ? ch.volume : 0.4);
      if (ch.vibrato) channel.setVibrato(ch.vibrato[0], ch.vibrato[1]);
      this._bgmSeqIdx.push(0);
      this._bgmNoteIdx.push(0);
      this._bgmChTime.push(startTime);
    }

    this._bgmLoopId++;
    this._schedulerLoop(this._bgmLoopId);
  }

  _schedulerLoop(loopId) {
    if (!this._bgmPlaying || loopId !== this._bgmLoopId || this._disposed) return;

    const song = this._bgmSong;
    const secPerBeat = 60 / this._bgmBPM;
    const chCount = Math.min(song.channels.length, 8);
    const horizon = this._ctx.currentTime + this._bgmScheduleAhead;

    // Track cumulative beat position per channel for swing
    if (!this._bgmBeatPos) this._bgmBeatPos = new Float64Array(8);

    let anyActive = false;
    for (let i = 0; i < chCount; i++) {
      const chDef = song.channels[i];
      const channel = this._channels[i];
      const seq = chDef.sequence || [0];

      // Schedule notes for this channel until we're past the horizon
      while (this._bgmChTime[i] < horizon) {
        // Check if sequence is done
        if (this._bgmSeqIdx[i] >= seq.length) {
          if (song.loop !== false) {
            this._bgmSeqIdx[i] = 0;
            this._bgmBeatPos[i] = 0;
          } else break;
        }

        const patIdx = seq[this._bgmSeqIdx[i]];
        const pattern = chDef.patterns[patIdx];
        if (!pattern || pattern.length === 0) break;

        // Advance to next pattern if we finished this one
        if (this._bgmNoteIdx[i] >= pattern.length) {
          this._bgmNoteIdx[i] = 0;
          this._bgmSeqIdx[i]++;
          continue; // re-check sequence bounds
        }

        const noteData = pattern[this._bgmNoteIdx[i]];
        const noteName = noteData[0];
        const durationBeats = noteData[1];
        const overrides = noteData[2];

        if (overrides) {
          if (overrides.v !== undefined) channel.setVolume(overrides.v);
          if (overrides.voice) channel.setVoice(overrides.voice);
        }

        const durSec = durationBeats * secPerBeat;

        // Swing: offset notes that land on off-beats (odd 8th-note positions)
        let time = this._bgmChTime[i];
        if (song.swing) {
          const eighthPos = Math.round(this._bgmBeatPos[i] * 2);
          if (eighthPos % 2 === 1) {
            time += secPerBeat * 0.5 * song.swing * 0.5;
          }
        }

        const freq = noteToFreq(noteName);
        channel.playNote(freq, time, durSec * 0.9);

        this._bgmBeatPos[i] += durationBeats;
        this._bgmChTime[i] += durSec;
        this._bgmNoteIdx[i]++;
      }

      if (this._bgmSeqIdx[i] < seq.length || song.loop !== false) anyActive = true;
    }

    if (!anyActive) {
      this._bgmPlaying = false;
      return;
    }

    setTimeout(() => this._schedulerLoop(loopId), this._bgmLookahead);
  }

  stopSong() {
    this._bgmPlaying = false;
    this._bgmLoopId++;
    this._bgmSong = null;
    for (const ch of this._channels) ch.stop();
  }

  get isPlaying() { return this._bgmPlaying; }

  // ── Fade BGM in/out ───────────────────────────────────────────────────────
  fadeBGM(targetVol, durationSec = 1) {
    if (!this._bgmGain) return;
    this._bgmGain.gain.setTargetAtTime(
      targetVol, this._ctx.currentTime, durationSec / 3
    );
  }

  // ── Direct channel access (for advanced use) ─────────────────────────────
  channel(i) { return this._channels[i]; }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  dispose() {
    this._disposed = true;
    this.stopSong();
    if (this._ctx && this._ctx.state !== 'closed') {
      try { this._ctx.close(); } catch {}
    }
    this._channels = [];
  }

  // ── Utility: get AudioContext ─────────────────────────────────────────────
  get audioContext() { return this._ctx; }

  // ── List available SFX ────────────────────────────────────────────────────
  static get SFX_LIST() { return Object.keys(SFX_PRESETS); }
}

// ── Convenience singleton ────────────────────────────────────────────────────
let _instance = null;
export function getChiptuneEngine(audioCtx) {
  if (!_instance) {
    _instance = new ChiptuneEngine(audioCtx);
  }
  return _instance;
}

export { noteToFreq, SFX_PRESETS, VOICE_TYPES, DEFAULT_ENV };
