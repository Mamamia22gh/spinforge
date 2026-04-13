/**
 * Audio manager — procedural sounds for casino ambience.
 */
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._initialized = false;
    this._spinNode = null;
    this._spinGain = null;
  }

  init() {
    if (this._initialized) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._initialized = true;
  }

  play(sound) {
    if (!this._ctx) return;

    switch (sound) {
      case 'spin':     this._playTone(220, 0.15, 'triangle'); break;
      case 'win':      this._playChord([440, 554, 659], 0.3); break;
      case 'lose':     this._playTone(110, 0.3, 'sawtooth', 0.15); break;
      case 'click':    this._playTone(800, 0.05, 'square', 0.1); break;
      case 'chip':     this._playTone(1200, 0.08, 'sine', 0.08); break;
      case 'tick':     this._playTone(2400, 0.03, 'sine', 0.06); break;
      case 'fever':    this._playChord([523, 659, 784, 1046], 0.5); break;
      case 'jackpot':  this._playArpeggio([523, 659, 784, 1046], 0.15); break;
    }
  }

  /**
   * Start continuous rolling sound. Call every frame with wheel speed.
   * @param {number} speed — wheel angular velocity (0 = stopped)
   */
  updateSpinSound(speed) {
    if (!this._ctx) return;

    if (speed > 0.1) {
      if (!this._spinNode) {
        this._startSpinLoop();
      }
      // Pitch & volume follow speed
      const normalizedSpeed = Math.min(1, speed / 18);
      const freq = 60 + normalizedSpeed * 180;
      const vol = 0.03 + normalizedSpeed * 0.12;

      if (this._spinOsc) this._spinOsc.frequency.value = freq;
      if (this._spinOsc2) this._spinOsc2.frequency.value = freq * 1.5;
      if (this._spinGain) this._spinGain.gain.value = vol;
    } else {
      this._stopSpinLoop();
    }
  }

  _startSpinLoop() {
    if (this._spinNode) return;

    // Low rumble oscillator
    this._spinOsc = this._ctx.createOscillator();
    this._spinOsc.type = 'triangle';
    this._spinOsc.frequency.value = 100;

    // Higher harmonic
    this._spinOsc2 = this._ctx.createOscillator();
    this._spinOsc2.type = 'sine';
    this._spinOsc2.frequency.value = 150;

    this._spinGain = this._ctx.createGain();
    this._spinGain.gain.value = 0.05;

    // Low pass filter for rumble feel
    const filter = this._ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    this._spinOsc.connect(filter);
    this._spinOsc2.connect(filter);
    filter.connect(this._spinGain);
    this._spinGain.connect(this._ctx.destination);

    this._spinOsc.start();
    this._spinOsc2.start();
    this._spinNode = true;
    this._spinFilter = filter;
  }

  _stopSpinLoop() {
    if (!this._spinNode) return;
    try {
      if (this._spinGain) {
        this._spinGain.gain.setValueAtTime(this._spinGain.gain.value, this._ctx.currentTime);
        this._spinGain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.3);
      }
      setTimeout(() => {
        try {
          this._spinOsc?.stop();
          this._spinOsc2?.stop();
        } catch {}
        this._spinOsc = null;
        this._spinOsc2 = null;
        this._spinGain = null;
        this._spinFilter = null;
        this._spinNode = null;
      }, 350);
    } catch {
      this._spinNode = null;
    }
  }

  _playTone(freq, duration, type = 'sine', vol = 0.2) {
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
    osc.connect(gain).connect(this._ctx.destination);
    osc.start();
    osc.stop(this._ctx.currentTime + duration);
  }

  _playChord(freqs, duration) {
    for (const f of freqs) this._playTone(f, duration, 'sine', 0.1);
  }

  _playArpeggio(freqs, spacing) {
    freqs.forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.3, 'sine', 0.15), i * spacing * 1000);
    });
  }
}
