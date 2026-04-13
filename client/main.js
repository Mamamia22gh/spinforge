import { createGame } from '../src/index.js';
import { BALANCE, getQuota } from '../src/data/balance.js';
import { PixelWheel } from './objects/PixelWheel.js';
import { PAL, SYM_COLORS } from './gfx/PaletteDB.js';
import { drawText, drawTextCentered, drawTextCenteredOutlined, drawTextWrapped, measureText, CHAR_W, CHAR_H } from './gfx/BitmapFont.js';
import { drawSpriteCentered, drawAnimSpriteCentered, drawAnimFrameCentered, getAnimFrameCount, SPRITE_SIZE } from './gfx/PixelSprites.js';
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
    this.wheel.setBonusMode(false);

    // Convert surplus gold to diamonds
    const endRun = this.game.getState().run;
    if (endRun) {
      const endQuota = getQuota(endRun.round);
      const surplus = Math.max(0, endRun.score - endQuota);
      const earned = Math.floor(surplus / 5);
      if (earned > 0) this._diamonds += earned;
    }
    this._time = 0;
    this._pops = [];
    this._shake = { x: 0, y: 0, intensity: 0, decay: 0, time: 0 };
    this._flash = 0;
    this._diamonds = 0;
    this._goldDisplay = 0; // animated gold counter // invert flash timer (>0 = active)

    // Mouse tracking (normalized -1..1 from center)
    this._mx = 0;
    this._my = 0;
    this._hubHover = false;
    this._sweepTrigger = -99;  // time of last hover-triggered sweep

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
    this.wheel.onBallEject = () => this._playEject();

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

    // Hub hover detection
    const x = Math.floor((e.clientX - rect.left) / rect.width * W);
    const y = Math.floor((e.clientY - rect.top) / rect.height * H);
    const dx = x - WHEEL_CX;
    const dy = (y - WHEEL_CY) / (this.wheel.tilt || 0.65);
    const wasHover = this._hubHover;
    this._hubHover = dx * dx + dy * dy < 40 * 40;
    this._display.style.cursor = this._hubHover && !this._spinning ? 'pointer' : 'default';

    // Trigger sweep on hover enter
    if (this._hubHover && !wasHover) this._sweepTrigger = this._time;
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
    this.wheel.hubSetScore(0);
    this._goldDisplay = 0;
    const results = await this.wheel.spinAndEject();
    this._stopSpin();

    // Reveal sequence
    for (let i = 0; i < results.length; i++) {
      const result = this.game.resolveBallAt(results[i]);
      if (!result) continue;

      this.wheel.highlight(results[i]);
      this.wheel.hubShowValue(result.result.symbol.id, result.value);
      this.wheel.hubSetScore(this.game.getState().run.score);
      this._goldDisplay = this.game.getState().run.score;
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

      // Shake on quota reached + invert flash + bonus mode
      const run3 = this.game.getState().run;
      if (run3.score >= getQuota(run3.round) && run3.score - result.value < getQuota(run3.round)) {
        this._shakeStart(5, 0.5);
        this._flash = 0.3;
        this.wheel.setBonusMode(true);
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

    // UI Ring (parallax layer 2.5 — between slots and title)
    const uiOx = px * 3;
    const uiOy = py * 2.5;
    this._drawUIRing(ctx, WHEEL_CX + uiOx, WHEEL_CY + uiOy);

    // Title (parallax layer 3 — moves most)
    drawTextCentered(ctx, 'SPINFORGE', W / 2 + hudOx, 6 + hudOy, PAL.gold, 3);

    // Commit hash (bottom right)
    drawText(ctx, typeof __COMMIT__ !== 'undefined' ? __COMMIT__ : '???', W - 40, H - 8, PAL.midGray, 1);

    this._drawPops(ctx);

    // Hub button (always on top of everything)
    this._drawHubBtn(ctx, wheelOx, wheelOy);

    ctx.restore(); // end PX scale

    // ── Invert flash (difference blend) ──
    if (this._flash > 0) {
      this._flash -= 1 / 60;
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = Math.min(1, this._flash / 0.15);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

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

  // ── Hub button (round, drawn on top of everything) ──
  _drawHubBtn(ctx, wox, woy) {
    const r = this.wheel.hubRadius || 42;
    const tilt = this.wheel.tilt || 0.65;
    const t = this._time;
    const pressed = this._spinning;
    const hover = this._hubHover && !pressed;
    const run = this.game.getState().run;
    const quota = run ? getQuota(run.round) : 0;
    const score = run ? run.score : 0;

    ctx.save();
    ctx.translate(WHEEL_CX + wox, WHEEL_CY + woy);
    ctx.scale(1, tilt);

    // Raised by default, higher on hover, flush when pressed
    if (!pressed) ctx.translate(0, hover ? -4 : -2);

    // Fill (blinks gold/darkGold at 4Hz when quota reached during spin)
    const quotaReached = pressed && score >= quota;

    if (quotaReached) {
      ctx.fillStyle = Math.sin(t * 8 * Math.PI) > 0 ? PAL.gold : PAL.darkGold;
    } else {
      ctx.fillStyle = PAL.gold;
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Hover brighten (subtle white overlay on gold)
    if (hover) {
      ctx.fillStyle = PAL.white;
      ctx.globalAlpha = 0.15;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Glass sweep (idle only — periodic + hover triggered)
    if (!pressed) {
      const SWEEP_INTERVAL = 3.5;
      const SWEEP_DUR = 0.25;
      const periodicT = t % SWEEP_INTERVAL;
      const hoverT = t - this._sweepTrigger;
      const sweepActive = periodicT < SWEEP_DUR || (hoverT >= 0 && hoverT < SWEEP_DUR);
      const sweepProgress = periodicT < SWEEP_DUR ? periodicT / SWEEP_DUR :
                            (hoverT >= 0 && hoverT < SWEEP_DUR) ? hoverT / SWEEP_DUR : -1;
      if (sweepActive && sweepProgress >= 0) {
        const sx = -r + sweepProgress * r * 2;
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

    // Pressed overlay (darken, only if quota NOT yet reached)
    if (pressed && !quotaReached) {
      ctx.fillStyle = PAL.black;
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (pressed) {
      if (quotaReached) {
        // Quota reached: BONUS + surplus with coin on right (scale 2)
        const surplus = score - quota;
        drawTextCentered(ctx, 'BONUS', 0, -Math.floor(CHAR_H * 1.5), PAL.black, 1);
        const bStr = '+' + surplus;
        const bW = bStr.length * CHAR_W * 2;
        const bY = Math.floor(CHAR_H * 0.5);
        const bCoinW = SPRITE_SIZE * 2;
        const bOx = Math.round(-(2 + bCoinW) / 2);
        drawTextCentered(ctx, bStr, bOx, bY, PAL.gold, 2);
        drawAnimSpriteCentered(ctx, 'coin', Math.round(bOx + bW / 2 + 2 + SPRITE_SIZE), bY + CHAR_H, 2, t, 8);
      } else {
        // During spin: score with coin (scale 2), /quota below without coin
        const sStr = String(score);
        const sW = sStr.length * CHAR_W * 2;
        const sY = -Math.floor(CHAR_H * 1.5);
        drawTextCentered(ctx, sStr, 0, sY, PAL.gold, 2);
        drawAnimSpriteCentered(ctx, 'coin', Math.round(sW / 2 + 2 + SPRITE_SIZE), sY + CHAR_H, 2, t, 8);
        drawTextCentered(ctx, '/' + quota, 0, Math.floor(CHAR_H * 1.5), PAL.darkGray, 2);
      }
    } else {
      // Idle: SPIN label + quota with coin on right
      drawTextCentered(ctx, 'SPIN', 0, -Math.floor(CHAR_H * 1.5), PAL.black, 2);
      const qStr = 'QUOTA ' + quota;
      const qW = qStr.length * CHAR_W;
      const qY = Math.floor(CHAR_H * 0.5);
      const coinSz = SPRITE_SIZE;
      const qGap = 1;
      const qOx = Math.round(-(qGap + coinSz) / 2);
      drawTextCentered(ctx, qStr, qOx, qY, PAL.darkGray, 1);
      drawAnimSpriteCentered(ctx, 'coin', Math.round(qOx + qW / 2 + qGap + coinSz / 2) + 2, qY + Math.floor(CHAR_H / 2) - 1, 1, t, 4);
    }

    ctx.restore();
  }

  // ── UI Ring (gold + tickets around the wheel) ──
  _drawUIRing(ctx, cx, cy) {
    const RING_R = 115;
    const run = this.game.getState().run;
    const score = run ? run.score : 0;

    // Ring outline
    ctx.beginPath();
    ctx.arc(cx, cy, RING_R, 0, Math.PI * 2);
    ctx.strokeStyle = PAL.midGray;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gold counter (bottom-left)
    const goldStr = String(score);
    const gx = Math.round(cx - 35);
    const gy = Math.round(cy + RING_R + 10);
    drawAnimSpriteCentered(ctx, 'coin', gx, gy, 1, this._time, 6);
    drawText(ctx, goldStr, gx + 7, gy - Math.floor(CHAR_H / 2), PAL.gold, 1);

    // Ticket counter (bottom-right)
    const tx = Math.round(cx + 15);
    const ty = gy;
    drawSpriteCentered(ctx, 'star', tx, ty, 1);
    drawText(ctx, String(this._diamonds), tx + 7, ty - Math.floor(CHAR_H / 2), PAL.green, 1);
  }

  // ── Popups ──
  _drawPops(ctx) {
    for (const p of this._pops) {
      const col = p.age < 1.0 ? PAL.gold : PAL.darkGold;
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      const textW = p.text.length * CHAR_W;
      const coinSz = SPRITE_SIZE;
      const totalW = coinSz + 2 + textW;
      const alpha = p.age < 1.0 ? 1 : Math.max(0, 1 - (p.age - 1.0) / 0.5);
      ctx.globalAlpha = alpha;
      drawTextCenteredOutlined(ctx, p.text, Math.round(px - totalW / 2 + textW / 2), py, col, 1);
      drawAnimSpriteCentered(ctx, 'coin', Math.round(px - totalW / 2 + textW + 2 + coinSz / 2), py + Math.floor(CHAR_H / 2), 1, this._time, 6);
      ctx.globalAlpha = 1;
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

  _playEject() {
    this._tone(1400 + Math.random() * 200, 0.04, 'sine', 0.05);
    setTimeout(() => this._tone(900 + Math.random() * 200, 0.03, 'square', 0.03), 20);
  }

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
    // Filtered noise (mechanical whirr, not engine drone)
    const bufLen = this._audioCtx.sampleRate * 2;
    const buf = this._audioCtx.createBuffer(1, bufLen, this._audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    this._spinNoise = this._audioCtx.createBufferSource();
    this._spinNoise.buffer = buf;
    this._spinNoise.loop = true;
    this._spinFilter = this._audioCtx.createBiquadFilter();
    this._spinFilter.type = 'bandpass';
    this._spinFilter.frequency.value = 300;
    this._spinFilter.Q.value = 2;
    this._spinGain = this._audioCtx.createGain();
    this._spinGain.gain.value = 0.03;
    this._spinNoise.connect(this._spinFilter);
    this._spinFilter.connect(this._spinGain);
    this._spinGain.connect(this._audioCtx.destination);
    this._spinNoise.start();
    this._spinInterval = setInterval(() => {
      const spd = Math.min(1, this.wheel.speed / 18);
      if (this._spinFilter) this._spinFilter.frequency.value = 200 + spd * 800;
      if (this._spinGain) this._spinGain.gain.value = 0.01 + spd * 0.04;
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
    try { this._spinNoise?.stop(); } catch {}
    this._spinNoise = null;
    this._spinFilter = null;
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
