import { createGame } from '../src/index.js';
import { BALANCE, getQuota } from '../src/data/balance.js';
import { PixelWheel } from './objects/PixelWheel.js';
import { PAL, SYM_COLORS } from './gfx/PaletteDB.js';
import { drawText, drawTextCentered, drawTextWrapped, measureText, CHAR_W, CHAR_H } from './gfx/BitmapFont.js';
import { drawSpriteCentered, SPRITE_SIZE } from './gfx/PixelSprites.js';
import { getSymbol } from '../src/data/symbols.js';
import { CRTFilter } from './gfx/CRTFilter.js';
import { quantize } from './gfx/PaletteQuantizer.js';

// ── Canvas resolution (CSS scales this to viewport with nearest-neighbor) ──
const W = 480, H = 270;
const PX = 2;                          // pixel scale — each art pixel = PX×PX canvas pixels
const CW = W * PX, CH = H * PX;       // canvas resolution (960×540)
const WHEEL_CX = 240, WHEEL_CY = 125;

class App {
  constructor() {
    this._canvas = document.getElementById('game');
    this._canvas.width = CW;
    this._canvas.height = CH;
    this._ctx = this._canvas.getContext('2d');

    this.game = createGame({ seed: Date.now() });
    this.wheel = new PixelWheel();
    this._spinning = false;
    this._showTitle = true;
    this._time = 0;
    this._pops = [];

    // Clickable regions (computed each frame)
    this._choiceCards = null;
    this._shopCards = null;

    // Init default wheel
    const defaultWheel = BALANCE.INITIAL_WHEEL.map((id, i) => ({
      id: 'seg_' + i, symbolId: id, weight: 1, modifiers: [],
    }));
    this.wheel.setWheel(defaultWheel);
    this.wheel.placeBalls(BALANCE.BALLS_PER_ROUND);

    // Dim pattern (checkerboard for overlay dimming)
    this._dimPattern = this._createDimPattern();

    // CRT post-process (barrel distortion + chroma + scanlines + vignette)
    this._crt = new CRTFilter(CW, CH);

    // Audio
    this._audioCtx = null;
    this.wheel.onPegHit = () => this._tick();

    // Input
    this._canvas.addEventListener('click', e => this._handleClick(e));

    // Render loop
    this._lastTime = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  // ── Input ──
  _mapCoords(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / rect.width * W),
      y: Math.floor((e.clientY - rect.top) / rect.height * H),
    };
  }

  _hitBtn(btn, x, y) {
    return btn && x >= btn.x && x < btn.x + btn.w && y >= btn.y && y < btn.y + btn.h;
  }

  _handleClick(e) {
    this._initAudio();
    const { x, y } = this._mapCoords(e);

    // Choice cards (priority over hub)
    const phase = this._showTitle ? null : this.game.getPhase();
    if (phase === 'CHOICE' && this._choiceCards) {
      for (let i = 0; i < this._choiceCards.length; i++) {
        if (this._hitBtn(this._choiceCards[i], x, y)) {
          const run = this.game.getState().run;
          const c = run.currentChoices[i];
          if (c.type === 'add_symbol' || c.type === 'upgrade') this.game.makeChoice(i);
          else this.game.makeChoice(i, 0);
          this._playSelect();
          this._syncWheel();
          return;
        }
      }
    }

    // Shop cards (priority over hub)
    if (phase === 'SHOP' && this._shopCards) {
      for (let i = 0; i < this._shopCards.length; i++) {
        if (this._hitBtn(this._shopCards[i], x, y)) {
          const run = this.game.getState().run;
          if (run.shopCurrency >= run.shopOfferings[i].finalCost) {
            this.game.shopBuyRelic(i);
            this._playCoin();
          }
          return;
        }
      }
    }

    // Hub button click (ellipse hit test with tilt)
    const dx = x - WHEEL_CX;
    const dy = (y - WHEEL_CY) / (this.wheel.tilt || 0.65);
    if (dx * dx + dy * dy < 40 * 40) {
      if (this._spinning) return;
      if (this._showTitle) this._startGame();
      else this._onAction();
      return;
    }
  }

  // ── Game flow ──
  _startGame() {
    this._showTitle = false;
    this.game.startRun();
    this._syncWheel();
  }

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
    } else if (phase === 'RESULTS') {
      this.game.continueFromResults();
    } else if (phase === 'CHOICE') {
      this.game.skipChoice();
    } else if (phase === 'SHOP') {
      this.game.endShop();
      this._syncWheel();
    } else if (phase === 'GAME_OVER' || phase === 'VICTORY') {
      this._showTitle = true;
    }
  }

  async _doSpin() {
    if (this._spinning) return;
    this._spinning = true;

    const run = this.game.getState().run;
    this._playSpin();
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
      await this._delay(450);
    }

    this._spinning = false;
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

    // Clear
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, W, H);

    // Wheel always visible
    this.wheel.draw(ctx, WHEEL_CX, WHEEL_CY);

    if (this._showTitle) {
      this._drawTitle(ctx);
    } else {
      this._drawHUD(ctx);
      this._drawPops(ctx);

      const phase = this.game.getPhase();
      if (phase === 'RESULTS') this._drawResults(ctx);
      else if (phase === 'CHOICE') this._drawChoices(ctx);
      else if (phase === 'SHOP') this._drawShop(ctx);
      else if (phase === 'GAME_OVER') this._drawGameOver(ctx);
      else if (phase === 'VICTORY') this._drawVictory(ctx);
    }

    // Hub button (always on top of everything)
    this._drawHubBtn(ctx);

    ctx.restore(); // end PX scale

    // ── Palette quantize (kill AA fringes) then light map then CRT ──
    quantize(ctx, CW, CH);
    this._drawLights(ctx);
    this._crt.apply(ctx);
  }

  // ── Light map (screen-mode glow, after quantize for smooth gradients) ──
  _drawLights(ctx) {
    ctx.globalCompositeOperation = 'screen';

    // Hub glow (stepped pulse, not smooth)
    if (!this._spinning) {
      let col;
      if (this._showTitle) col = PAL.green;
      else {
        const ph = this.game.getPhase();
        col = (ph === 'IDLE') ? PAL.green : (ph === 'GAME_OVER') ? PAL.red : PAL.gold;
      }
      const raw = Math.sin(this._time * 3);
      const stepped = Math.floor(raw * 4) / 4; // quantize to 4 levels
      const pulse = 0.08 + 0.06 * stepped;
      this._glow(ctx, WHEEL_CX * PX, WHEEL_CY * PX, 55 * PX, col, pulse);
    }

    // Wheel lights (balls + highlights)
    for (const l of this.wheel.lights) {
      this._glow(ctx, l.x * PX, l.y * PX, l.r * PX, l.color, l.a);
    }

    ctx.globalCompositeOperation = 'source-over';
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

  // ── Drawing helpers ──
  _createDimPattern() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const x = c.getContext('2d');
    x.fillStyle = PAL.black;
    x.fillRect(0, 0, 1, 1);
    x.fillRect(1, 1, 1, 1);
    return this._ctx.createPattern(c, 'repeat');
  }

  _drawDim(ctx) {
    ctx.fillStyle = this._dimPattern;
    ctx.fillRect(0, 0, W, H);
  }

  _drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = PAL.darkGray;
    ctx.fillRect(x, y, w, h);
    // Gold 1px border
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  _drawBtn(ctx, label, x, y, w, h, borderColor) {
    ctx.fillStyle = PAL.darkGray;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = borderColor;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    drawTextCentered(ctx, label, x + Math.floor(w / 2), y + Math.floor((h - CHAR_H) / 2), PAL.white, 1);
  }

  _makeBtn(label, cx, y, padX, h) {
    const tw = measureText(label);
    const w = tw + padX * 2;
    const x = Math.floor(cx - w / 2);
    return { x, y, w, h, label };
  }

  // ── Title screen ──
  _drawTitle(ctx) {
    this._drawDim(ctx);

    drawTextCentered(ctx, 'SPINFORGE', W / 2, 50, PAL.gold, 3);
    drawTextCentered(ctx, 'MYSTIC ROULETTE ROGUELIKE', W / 2, 78, PAL.midGray, 1);

    const meta = this.game.getMeta();
    drawTextCentered(ctx, 'STARS ' + meta.totalStars, W / 2, 160, PAL.gold, 1);
    drawTextCentered(ctx, 'BEST ROUND ' + meta.bestRound, W / 2, 172, PAL.midGray, 1);
  }

  // ── HUD ──
  _drawHUD(ctx) {
    const run = this.game.getState().run;
    if (!run) return;

    // Top left
    drawText(ctx, 'RND ' + run.round + '/' + BALANCE.ROUNDS_PER_RUN, 4, 4, PAL.green, 1);
    drawText(ctx, 'QUOTA ' + getQuota(run.round), 4, 14, PAL.midGray, 1);

    // Top right — score
    const scoreStr = String(run.score);
    const sw = measureText(scoreStr) * 2;
    drawText(ctx, scoreStr, W - 4 - sw, 4, PAL.gold, 2);

    // Balls
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      const bx = W - 4 - (BALANCE.BALLS_PER_ROUND - i) * 6;
      ctx.fillStyle = i < run.ballsLeft ? PAL.red : PAL.darkRed;
      ctx.fillRect(bx, 20, 4, 4);
    }
  }

  // ── Hub button (round, drawn on top of everything) ──
  _drawHubBtn(ctx) {
    if (this._spinning) return;

    let label, color;
    if (this._showTitle) {
      label = 'PLAY'; color = PAL.green;
    } else {
      const phase = this.game.getPhase();
      switch (phase) {
        case 'IDLE': label = 'SPIN'; color = PAL.green; break;
        case 'RESULTS': label = 'OK'; color = PAL.green; break;
        case 'CHOICE': label = 'SKIP'; color = PAL.gold; break;
        case 'SHOP': label = 'EXIT'; color = PAL.midGray; break;
        case 'GAME_OVER': label = 'END'; color = PAL.red; break;
        case 'VICTORY': label = 'END'; color = PAL.gold; break;
        default: return;
      }
    }

    const r = this.wheel.hubRadius || 42;
    const tilt = this.wheel.tilt || 0.65;
    const exciting = true; // glass sweep + glow on all states
    const t = this._time;

    ctx.save();
    ctx.translate(WHEEL_CX, WHEEL_CY);
    ctx.scale(1, tilt);

    // Fill
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = PAL.darkGray; ctx.fill();

    // Border
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2;
    ctx.stroke();

    // Highlight pixel (top edge, 3D bevel)
    ctx.fillStyle = PAL.midGray;
    ctx.fillRect(-r * 0.3, -r + 3, r * 0.6, 1);

    if (exciting) {
      // ── Glass sweep (white band every ~4s) ──
      const SWEEP_INTERVAL = 3.5;
      const SWEEP_DUR = 0.25;
      const sweepT = t % SWEEP_INTERVAL;
      if (sweepT < SWEEP_DUR) {
        const p = sweepT / SWEEP_DUR;
        const sx = -r + p * r * 2;
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = PAL.white;
        ctx.globalAlpha = 0.25;
        for (let dy = -r; dy <= r; dy += 1) {
          ctx.fillRect(Math.round(sx + dy * 0.4), dy, 2, 1);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Label (always centered)
    drawTextCentered(ctx, label, 0, -Math.floor(CHAR_H / 2), PAL.gold, 1);

    ctx.restore();
  }

  // ── Popups ──
  _drawPops(ctx) {
    for (const p of this._pops) {
      const col = p.age < 1.0 ? PAL.gold : PAL.darkGold;
      drawTextCentered(ctx, p.text, Math.round(p.x), Math.round(p.y), col, 1);
    }
  }

  // ── Results overlay ──
  _drawResults(ctx) {
    const run = this.game.getState().run;
    const r = run.lastRoundResult;
    this._drawDim(ctx);

    const pw = 180, ph = 150;
    const px = W / 2 - pw / 2, py = 20;
    this._drawPanel(ctx, px, py, pw, ph);

    const titleCol = r.passed ? PAL.green : PAL.red;
    drawTextCentered(ctx, r.passed ? 'ROUND PASSED!' : 'QUOTA FAILED!', W / 2, py + 6, titleCol, 1);

    let ly = py + 22;
    for (const sr of run.spinResults) {
      const sym = sr.symbol;
      drawSpriteCentered(ctx, sym.id, px + 12, ly + 3, 1);
      drawText(ctx, sym.name.toUpperCase().substring(0, 8), px + 22, ly, PAL.white, 1);
      const valStr = '+' + sr.value;
      const vw = measureText(valStr);
      drawText(ctx, valStr, px + pw - 6 - vw, ly, PAL.gold, 1);
      ly += 10;
      if (ly > py + ph - 30) break;
    }

    ly = py + ph - 24;
    drawTextCentered(ctx, r.totalWon + ' / ' + r.quota, W / 2, ly, PAL.gold, 1);
    if (r.passed && r.shopCoins > 0) {
      drawTextCentered(ctx, '+' + r.shopCoins + ' COINS', W / 2, ly + 10, PAL.green, 1);
    }
  }

  // ── Choices overlay ──
  _drawChoices(ctx) {
    const run = this.game.getState().run;
    const choices = run.currentChoices;
    this._drawDim(ctx);

    drawTextCentered(ctx, 'CHOOSE UPGRADE', W / 2, 18, PAL.gold, 2);

    this._choiceCards = [];
    const cardW = 100, cardH = 100, gap = 12;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = Math.floor(W / 2 - totalW / 2);

    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const cx = startX + i * (cardW + gap);
      const cy = 42;

      this._choiceCards.push({ x: cx, y: cy, w: cardW, h: cardH });
      this._drawPanel(ctx, cx, cy, cardW, cardH);

      // Sprite for symbol choices
      if (c.payload && c.payload.symbolId) {
        drawSpriteCentered(ctx, c.payload.symbolId, cx + cardW / 2, cy + 16, 2);
      }

      // Name
      drawTextCentered(ctx, c.name.toUpperCase().substring(0, 14), cx + cardW / 2, cy + 34, PAL.gold, 1);

      // Description (wrapped)
      drawTextWrapped(ctx, c.description, cx + 4, cy + 46, cardW - 8, PAL.lightGray, 1);
    }
  }

  // ── Shop overlay ──
  _drawShop(ctx) {
    const run = this.game.getState().run;
    this._drawDim(ctx);

    drawTextCentered(ctx, 'THE FORGE', W / 2, 10, PAL.gold, 2);
    drawTextCentered(ctx, 'COINS: ' + run.shopCurrency, W / 2, 28, PAL.green, 1);

    this._shopCards = [];
    const offerings = run.shopOfferings;
    const cardW = 100, cardH = 100, gap = 12;
    const totalW = offerings.length * cardW + (offerings.length - 1) * gap;
    const startX = Math.floor(W / 2 - totalW / 2);

    for (let i = 0; i < offerings.length; i++) {
      const o = offerings[i];
      const cx = startX + i * (cardW + gap);
      const cy = 42;
      const afford = run.shopCurrency >= o.finalCost;

      this._shopCards.push({ x: cx, y: cy, w: cardW, h: cardH });
      this._drawPanel(ctx, cx, cy, cardW, cardH);

      if (!afford) {
        // Dim locked card with scanlines
        for (let sy = cy + 1; sy < cy + cardH - 1; sy += 2) {
          ctx.fillStyle = PAL.black;
          ctx.fillRect(cx + 1, sy, cardW - 2, 1);
        }
      }

      // Name
      drawTextCentered(ctx, o.name.toUpperCase().substring(0, 14), cx + cardW / 2, cy + 8, afford ? PAL.gold : PAL.midGray, 1);

      // Description
      drawTextWrapped(ctx, o.description, cx + 4, cy + 22, cardW - 8, afford ? PAL.lightGray : PAL.midGray, 1);

      // Cost
      const costStr = o.finalCost + ' COINS';
      drawTextCentered(ctx, costStr, cx + cardW / 2, cy + cardH - 12, afford ? PAL.green : PAL.red, 1);
    }
  }

  // ── Game over / Victory ──
  _drawGameOver(ctx) {
    const run = this.game.getState().run;
    const meta = this.game.getMeta();
    this._drawDim(ctx);

    const pw = 160, ph = 80;
    const px = W / 2 - pw / 2, py = 60;
    this._drawPanel(ctx, px, py, pw, ph);

    drawTextCentered(ctx, 'GAME OVER', W / 2, py + 10, PAL.red, 2);
    drawTextCentered(ctx, 'ROUND ' + run.round + '  SCORE ' + run.score, W / 2, py + 34, PAL.white, 1);
    drawTextCentered(ctx, 'STARS ' + meta.totalStars, W / 2, py + 50, PAL.gold, 1);
  }

  _drawVictory(ctx) {
    const run = this.game.getState().run;
    const meta = this.game.getMeta();
    this._drawDim(ctx);

    const pw = 160, ph = 80;
    const px = W / 2 - pw / 2, py = 60;
    this._drawPanel(ctx, px, py, pw, ph);

    drawTextCentered(ctx, 'VICTORY!', W / 2, py + 10, PAL.gold, 2);
    drawTextCentered(ctx, 'SCORE ' + run.score, W / 2, py + 34, PAL.white, 1);
    drawTextCentered(ctx, 'STARS ' + meta.totalStars, W / 2, py + 50, PAL.gold, 1);
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

  _playWinFanfare() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.3, 'square', 0.08);
        this._tone(f * 0.5, 0.3, 'triangle', 0.04);
      }, i * 120);
    });
  }

  _playLose() {
    [220, 196, 175, 165].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.25, 'sawtooth', 0.06), i * 150);
    });
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
}

window.addEventListener('DOMContentLoaded', () => new App());
