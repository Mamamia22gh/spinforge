import { createGame } from '../src/index.js';
import { BALANCE, getQuota } from '../src/data/balance.js';
import { PixelWheel } from './objects/PixelWheel.js';
import { PAL, SYM_COLORS } from './gfx/PaletteDB.js';
import { drawText, drawTextCentered, drawTextWrapped, measureText, CHAR_W, CHAR_H } from './gfx/BitmapFont.js';
import { drawSpriteCentered, SPRITE_SIZE } from './gfx/PixelSprites.js';
import { getSymbol } from '../src/data/symbols.js';
import { PostFXGL } from './gfx/PostFXGL.js';

// ── Canvas resolution (CSS scales this to viewport with nearest-neighbor) ──
const W = 480, H = 270;
const PX = 2;                          // pixel scale — each art pixel = PX×PX canvas pixels
const CW = W * PX, CH = H * PX;       // canvas resolution (960×540)
const WHEEL_CX = 240, WHEEL_CY = 140;

class App {
  constructor() {
    this._canvas = document.createElement('canvas');
    this._canvas.width = CW;
    this._canvas.height = CH;
    this._ctx = this._canvas.getContext('2d');

    // Display canvas (WebGL post-FX)
    this._display = document.getElementById('game');
    this._display.width = CW;
    this._display.height = CH;

    this.game = createGame({ seed: Date.now() });
    this.wheel = new PixelWheel();
    this._spinning = false;
    this._time = 0;
    this._pops = [];
    this._shake = { x: 0, y: 0, intensity: 0, decay: 0, time: 0 };

    // Mouse tracking (normalized -1..1 from center)
    this._mx = 0;
    this._my = 0;

    // Init default wheel
    const defaultWheel = BALANCE.INITIAL_WHEEL.map((id, i) => ({
      id: 'seg_' + i, symbolId: id, weight: 1, modifiers: [],
    }));
    this.wheel.setWheel(defaultWheel);

    // Start game immediately
    this.game.startRun();
    this._syncWheel();

    // GPU post-process (replaces CPU quantizer + CRT filter)
    this._postfx = new PostFXGL(this._display);

    // Lights overlay (screen blend via CSS — NOT quantized)
    this._lightsCanvas = document.createElement('canvas');
    this._lightsCanvas.width = CW;
    this._lightsCanvas.height = CH;
    this._lightsCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;image-rendering:pixelated;image-rendering:crisp-edges;';
    document.body.appendChild(this._lightsCanvas);
    this._lightsCtx = this._lightsCanvas.getContext('2d');

    // Audio
    this._audioCtx = null;
    this.wheel.onPegHit = () => this._tick();

    // Input (on display canvas)
    this._display.addEventListener('click', e => this._handleClick(e));
    this._display.addEventListener('mousemove', e => this._handleMouse(e));

    // Render loop
    this._lastTime = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  // ── Input ──
  _mapCoords(e) {
    const rect = this._display.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / rect.width * W),
      y: Math.floor((e.clientY - rect.top) / rect.height * H),
    };
  }

  _handleMouse(e) {
    const rect = this._display.getBoundingClientRect();
    this._mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;   // -1..1
    this._my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;   // -1..1
  }

  _handleClick(e) {
    this._initAudio();
    const { x, y } = this._mapCoords(e);

    // Hub button click (ellipse hit test with tilt)
    const dx = x - WHEEL_CX;
    const dy = (y - WHEEL_CY) / (this.wheel.tilt || 0.65);
    if (dx * dx + dy * dy < 40 * 40) {
      if (this._spinning) return;
      this._onAction();
      return;
    }
  }

  // ── Game flow ──
  _syncWheel() {
    const state = this.game.getState();
    if (state.run) {
      this.wheel.setWheel(state.run.wheel);
      this.wheel.placeBalls(state.run.ballsLeft);
    }
  }

  _onAction() {
    const phase = this.game.getPhase();
    if (phase === 'IDLE' && !this._spinning) {
      this._doSpin();
    }
  }

  /** Auto-advance through non-interactive phases silently. */
  _autoAdvance() {
    let safety = 10;
    while (safety-- > 0) {
      const phase = this.game.getPhase();
      if (phase === 'IDLE') break;
      if (phase === 'RESULTS') {
        this.game.continueFromResults();
      } else if (phase === 'CHOICE') {
        this.game.skipChoice();
      } else if (phase === 'SHOP') {
        this.game.endShop();
      } else if (phase === 'GAME_OVER' || phase === 'VICTORY') {
        // Restart run
        this.game.startRun();
      } else break;
    }
    this._syncWheel();
  }

  async _doSpin() {
    if (this._spinning) return;
    this._spinning = true;

    this._playSpin();
    this._shakeStart(4, 0.3);
    await this._delay(200);
    const results = await this.wheel.spinAndEject();
    this._stopSpin();

    // Reveal sequence
    for (let i = 0; i < results.length; i++) {
      const result = this.game.resolveBallAt(results[i]);
      if (!result) continue;

      this.wheel.highlight(results[i]);
      this.wheel.hubShowValue(result.result.symbol.id, result.value);
      this.wheel.hubSetScore(this.game.getState().run.score);
      const run2 = this.game.getState().run;
      this.wheel.hubSetStreak(run2.colorStreak);
      this.wheel.hubSetFever(run2.fever?.active ?? false);

      if (run2.colorStreak >= 2) {
        this.wheel.hubMessage('STREAK X' + run2.colorStreak);
        this._playStreak(run2.colorStreak);
      }

      this._playReveal(i, results.length);
      this._pop('+' + result.value);

      // Shake on gold pocket
      if (result.result.symbol.id === 'gold') this._shakeStart(2, 0.2);

      // Shake on quota reached
      const run3 = this.game.getState().run;
      if (run3.score >= getQuota(run3.round) && run3.score - result.value < getQuota(run3.round)) {
        this._shakeStart(5, 0.5);
      }

      await this._delay(450);
    }

    this._spinning = false;

    // Auto-advance through results/choice/shop
    await this._delay(500);
    this._autoAdvance();
  }

  _pop(text) {
    this._pops.push({
      text,
      x: WHEEL_CX + (Math.random() - 0.5) * 60,
      y: WHEEL_CY - 50 - Math.random() * 20,
      age: 0,
    });
  }

  // ── Render loop ──
  _loop(time) {
    requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((time - this._lastTime) / 1000, 0.05);
    this._lastTime = time;
    this._time += dt;

    this.wheel.update(dt);

    // Shake decay
    if (this._shake.intensity > 0) {
      this._shake.time += dt;
      const t = Math.min(1, this._shake.time / this._shake.decay);
      const amp = this._shake.intensity * (1 - t);
      this._shake.x = Math.round((Math.random() - 0.5) * 2 * amp);
      this._shake.y = Math.round((Math.random() - 0.5) * 2 * amp);
      if (t >= 1) { this._shake.intensity = 0; this._shake.x = 0; this._shake.y = 0; }
    }

    // Update pops
    for (let i = this._pops.length - 1; i >= 0; i--) {
      this._pops[i].age += dt;
      this._pops[i].y -= dt * 25;
      if (this._pops[i].age > 1.5) this._pops.splice(i, 1);
    }

    this._render();
  }

  _render() {
    const ctx = this._ctx;
    ctx.imageSmoothingEnabled = false;

    // Draw everything in logical 480×270 space, scaled 2×
    ctx.save();
    ctx.scale(PX, PX);
    ctx.translate(this._shake.x, this._shake.y);

    // Clear
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, W, H);

    // ── Parallax offsets ──
    const px = this._mx;   // -1..1
    const py = this._my;
    const wheelOx = px * 1.5;    // wheel: 1.5px max
    const wheelOy = py * 1;
    const periOx = px * 2;       // gauge + slots: 2px max
    const periOy = py * 2;
    const hudOx = px * 4.5;      // HUD: 4.5px max (fastest)
    const hudOy = py * 3;

    // Wheel (parallax layer 1) + peripherals (layer 2)
    this.wheel.draw(ctx, WHEEL_CX + wheelOx, WHEEL_CY + wheelOy, periOx - wheelOx, periOy - wheelOy);

    // Title (parallax layer 3 — moves most)
    drawTextCentered(ctx, 'SPINFORGE', W / 2 + hudOx, 6 + hudOy, PAL.gold, 3);

    // Commit hash (bottom right)
    drawText(ctx, typeof __COMMIT__ !== 'undefined' ? __COMMIT__ : '???', W - 40, H - 8, PAL.midGray, 1);

    this._drawPops(ctx);

    // Hub button (always on top of everything)
    this._drawHubBtn(ctx, wheelOx, wheelOy);

    ctx.restore(); // end PX scale

    // ── GPU post-process (quantize + scanlines + vignette) ──
    this._postfx.apply(this._canvas);

    // ── Lights overlay (smooth, NOT quantized) ──
    this._drawLights(wheelOx, wheelOy);
  }

  // ── Light map (screen-mode glow, after quantize for smooth gradients) ──
  _drawLights(wox, woy) {
    const ctx = this._lightsCtx;
    ctx.clearRect(0, 0, CW, CH);

    // Hub glow (always active, stepped pulse)
    if (!this._spinning) {
      const raw = Math.sin(this._time * 3);
      const stepped = Math.floor(raw * 4) / 4;
      const pulse = 0.12 + 0.08 * stepped;
      this._glow(ctx, (WHEEL_CX + wox) * PX, (WHEEL_CY + woy) * PX, 65 * PX, PAL.gold, pulse);
    }

    // Cursor light (follows mouse, warm)
    const clx = (W / 2 + this._mx * W / 2) * PX;
    const cly = (H / 2 + this._my * H / 2) * PX;
    this._glow(ctx, clx, cly, 80 * PX, PAL.gold, 0.06);

    // Wheel lights (balls + highlights)
    for (const l of this.wheel.lights) {
      this._glow(ctx, (l.x + wox) * PX, (l.y + woy) * PX, l.r * PX, l.color, l.a);
    }
  }

  _glow(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── HUD ──
  _drawHUD(ctx, ox, oy) {
    const run = this.game.getState().run;
    if (!run) return;

    // Top left
    drawText(ctx, 'RND ' + run.round + '/' + BALANCE.ROUNDS_PER_RUN, 4 + ox, 4 + oy, PAL.green, 1);
    drawText(ctx, 'QUOTA ' + getQuota(run.round), 4 + ox, 14 + oy, PAL.midGray, 1);

    // Top right — score
    const scoreStr = String(run.score);
    const sw = measureText(scoreStr) * 2;
    drawText(ctx, scoreStr, W - 4 - sw + ox, 4 + oy, PAL.gold, 2);

    // Balls
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      const bx = W - 4 - (BALANCE.BALLS_PER_ROUND - i) * 6 + ox;
      ctx.fillStyle = i < run.ballsLeft ? PAL.red : PAL.darkRed;
      ctx.fillRect(bx, 20 + oy, 4, 4);
    }
  }

  // ── Hub button (round, drawn on top of everything) ──
  _drawHubBtn(ctx, wox, woy) {
    const r = this.wheel.hubRadius || 42;
    const tilt = this.wheel.tilt || 0.65;
    const t = this._time;
    const pressed = this._spinning;
    const run = this.game.getState().run;
    const quota = run ? getQuota(run.round) : 0;
    const score = run ? run.score : 0;

    ctx.save();
    ctx.translate(WHEEL_CX + wox, WHEEL_CY + woy);
    ctx.scale(1, tilt);

    // Raised by default, flush when pressed
    if (!pressed) ctx.translate(0, -2);

    // Fill (bright gold)
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = PAL.gold; ctx.fill();

    // Glass sweep (idle only, BEFORE pressed overlay)
    if (!pressed) {
      const SWEEP_INTERVAL = 3.5;
      const SWEEP_DUR = 0.25;
      const sweepT = t % SWEEP_INTERVAL;
      if (sweepT < SWEEP_DUR) {
        const p = sweepT / SWEEP_DUR;
        const sx = -r + p * r * 2;
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = PAL.white;
        ctx.globalAlpha = 0.65;
        for (let dy = -r; dy <= r; dy += 1) {
          ctx.fillRect(Math.round(sx + dy * 0.4), dy, 3, 1);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Pressed overlay (darken)
    if (pressed) {
      ctx.fillStyle = PAL.black;
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (pressed) {
      // During spin: show score / quota
      drawTextCentered(ctx, String(score), 0, -Math.floor(CHAR_H * 1.5), PAL.gold, 2);
      drawTextCentered(ctx, '/' + quota, 0, Math.floor(CHAR_H * 0.5), PAL.darkGray, 1);
    } else {
      // Idle: SPIN label + quota below
      drawTextCentered(ctx, 'SPIN', 0, -Math.floor(CHAR_H * 1.5), PAL.black, 2);
      drawTextCentered(ctx, 'QUOTA ' + quota, 0, Math.floor(CHAR_H * 0.5), PAL.darkGray, 1);
    }

    ctx.restore();
  }

  // ── Popups ──
  _drawPops(ctx) {
    for (const p of this._pops) {
      const col = p.age < 1.0 ? PAL.gold : PAL.darkGold;
      drawTextCentered(ctx, p.text, Math.round(p.x), Math.round(p.y), col, 1);
    }
  }

  // ── Audio ──
  _initAudio() { if (this._audioCtx) return; this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

  _tone(freq, dur, type = 'square', vol = 0.06) {
    if (!this._audioCtx) return;
    const o = this._audioCtx.createOscillator(), g = this._audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this._audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this._audioCtx.currentTime + dur);
    o.connect(g).connect(this._audioCtx.destination); o.start(); o.stop(this._audioCtx.currentTime + dur);
  }

  _tick() { this._tone(800 + Math.random() * 400, 0.02, 'square', 0.03); }

  _playReveal(idx, total) {
    const notes = [523, 587, 659, 784, 880, 1047];
    const f = notes[Math.min(idx, notes.length - 1)];
    this._tone(f, 0.2, 'square', 0.08);
    setTimeout(() => this._tone(f * 1.5, 0.15, 'sine', 0.04), 50);
  }

  _playStreak(count) {
    const base = 440 + count * 80;
    [0, 100, 200].forEach((d, i) => {
      setTimeout(() => this._tone(base + i * 60, 0.15, 'square', 0.06), d);
    });
  }

  _playSpin() {
    if (!this._audioCtx) return;
    this._killSpin();
    this._spinOsc = this._audioCtx.createOscillator();
    this._spinOsc2 = this._audioCtx.createOscillator();
    this._spinGain = this._audioCtx.createGain();
    const filt = this._audioCtx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 500;
    this._spinOsc.type = 'triangle'; this._spinOsc.frequency.value = 80;
    this._spinOsc2.type = 'sawtooth'; this._spinOsc2.frequency.value = 120;
    this._spinGain.gain.value = 0.04;
    this._spinOsc.connect(filt); this._spinOsc2.connect(filt);
    filt.connect(this._spinGain).connect(this._audioCtx.destination);
    this._spinOsc.start(); this._spinOsc2.start();
    this._spinInterval = setInterval(() => {
      const spd = Math.min(1, this.wheel.speed / 18);
      if (this._spinOsc) this._spinOsc.frequency.value = 60 + spd * 180;
      if (this._spinOsc2) this._spinOsc2.frequency.value = 90 + spd * 150;
      if (this._spinGain) this._spinGain.gain.value = 0.02 + spd * 0.08;
    }, 50);
  }

  _stopSpin() {
    clearInterval(this._spinInterval);
    this._spinInterval = null;
    if (!this._spinGain) return;
    try {
      this._spinGain.gain.setValueAtTime(this._spinGain.gain.value, this._audioCtx.currentTime);
      this._spinGain.gain.exponentialRampToValueAtTime(0.001, this._audioCtx.currentTime + 0.3);
    } catch {}
    setTimeout(() => this._killSpin(), 350);
  }

  _killSpin() {
    try { this._spinOsc?.stop(); } catch {}
    try { this._spinOsc2?.stop(); } catch {}
    this._spinOsc = null;
    this._spinOsc2 = null;
    this._spinGain = null;
  }

  _playCoin() {
    this._tone(1200, 0.08, 'sine', 0.08);
    setTimeout(() => this._tone(1600, 0.06, 'sine', 0.06), 60);
  }

  _playSelect() {
    this._tone(660, 0.06, 'square', 0.06);
    setTimeout(() => this._tone(880, 0.08, 'square', 0.06), 50);
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  _shakeStart(intensity, decay) {
    this._shake.intensity = intensity;
    this._shake.decay = decay;
    this._shake.time = 0;
  }
}

window.addEventListener('DOMContentLoaded', () => new App());
