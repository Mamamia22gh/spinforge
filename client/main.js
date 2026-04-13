import { createGame } from '../src/index.js';
import { BALANCE, getQuota } from '../src/data/balance.js';
import { PixelWheel } from './objects/PixelWheel.js';

class App {
  constructor() {
    this.game = createGame({ seed: Date.now() });
    this.wheel = new PixelWheel(document.getElementById('wheel-canvas'));
    this._spinning = false;

    // DOM refs
    this._titleScreen = document.getElementById('title-screen');
    this._titleStars = document.getElementById('title-stars');
    this._titleBest = document.getElementById('title-best');
    this._hudLeft = document.getElementById('hud-left');
    this._hudRight = document.getElementById('hud-right');
    this._hudRound = document.getElementById('hud-round');
    this._hudQuota = document.getElementById('hud-quota');
    this._hudBalls = document.getElementById('hud-balls');
    this._hudScore = document.getElementById('hud-score');
    this._btn = document.getElementById('btn-action');
    this._hint = document.getElementById('hint-text');
    this._overlay = document.getElementById('overlay');
    this._winNotif = document.getElementById('win-notif');
    this._bottomBar = document.getElementById('bottom-bar');

    this._modSlotsEl = document.getElementById('mod-slots');
    this._modSlotCount = 8; // 8 orbital slots
    this._modSlotEls = [];
    this._buildModSlots();

    // Init default wheel
    const defaultWheel = BALANCE.INITIAL_WHEEL.map((id, i) => ({
      id: 'seg_' + i, symbolId: id, weight: 1, modifiers: [],
    }));
    this.wheel.setWheel(defaultWheel);

    // Audio
    this._audioCtx = null;
    this.wheel.onPegHit = () => this._tick();

    // Events
    document.getElementById('btn-start').addEventListener('click', () => this._startGame());
    this._btn.addEventListener('click', () => this._onAction());

    // Resize canvas to viewport
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Show title meta
    this._updateTitle();

    // Render loop
    this._lastTime = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    const c = this.wheel._canvas;
    c.width = 480;
    c.height = 320;
    this.wheel.R = Math.min(c.width, c.height) * 0.48;
    this.wheel._updateRadii();
    const state = this.game.getState();
    const ballCount = state.run ? state.run.ballsLeft : BALANCE.BALLS_PER_ROUND;
    this.wheel.placeBalls(ballCount);
  }

  _updateTitle() {
    const meta = this.game.getMeta();
    this._titleStars.textContent = meta.totalStars;
    this._titleBest.textContent = meta.bestRound;
  }

  _startGame() {
    this._initAudio();
    this._titleScreen.classList.add('hidden');
    this._hudLeft.style.display = '';
    this._hudRight.style.display = '';
    this._bottomBar.style.display = '';

    this.game.startRun();
    this._syncWheel();
    this._updateUI();
  }

  _onAction() {
    this._initAudio();
    const phase = this.game.getPhase();
    const state = this.game.getState();

    if (phase === 'IDLE' && !this._spinning) {
      this._doSpin();
    } else if (phase === 'RESULTS') {
      this._overlay.classList.remove('active');
      this.game.continueFromResults();
      this._updateUI();
    } else if (phase === 'CHOICE') {
      this.game.skipChoice();
      this._updateUI();
    } else if (phase === 'SHOP') {
      const run = state.run;
      const idx = run.shopOfferings.findIndex(o => run.shopCurrency >= o.finalCost);
      if (idx >= 0) this.game.shopBuyRelic(idx);
      else this.game.endShop();
      if (this.game.getPhase() === 'IDLE') this._syncWheel();
      this._updateUI();
    } else if (phase === 'GAME_OVER' || phase === 'VICTORY') {
      this._overlay.classList.remove('active');
      this._hudLeft.style.display = 'none';
      this._hudRight.style.display = 'none';
      this._bottomBar.style.display = 'none';
      this._titleScreen.classList.remove('hidden');
      this._updateTitle();
    }
  }

  _syncWheel() {
    const state = this.game.getState();
    if (state.run) {
      this.wheel.setWheel(state.run.wheel);
      this.wheel.placeBalls(state.run.ballsLeft);
    }
  }

  async _doSpin() {
    if (this._spinning) return;
    this._spinning = true;
    this._overlay.classList.remove('active');

    const run = this.game.getState().run;
    this._updateHUD(run);
    this.wheel.placeBalls(run.ballsLeft);
    this._btn.disabled = true;
    this._btn.textContent = '...';

    this._playSpin();
    await this._delay(400);
    const results = await this.wheel.spin();
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
        this.wheel.hubMessage(`STREAK ×${run2.colorStreak}`);
        this._playStreak(run2.colorStreak);
      }

      this._playReveal(i, results.length);
      this._pop(`+${result.value}`, result.result.symbol.emoji);
      this._flash(`${result.result.symbol.emoji} +${result.value}`);
      this._updateHUD(this.game.getState().run);
      await this._delay(450);
    }

    this._spinning = false;
    this._updateUI();
  }

  // ── Mod Slots ──
  _buildModSlots() {
    this._modSlotsEl.innerHTML = '';
    this._modSlotEls = [];
    for (let i = 0; i < this._modSlotCount; i++) {
      const el = document.createElement('div');
      el.className = 'mod-slot locked';
      el.innerHTML = '🔒';
      const label = document.createElement('div');
      label.className = 'slot-label';
      label.textContent = `SLOT ${i + 1}`;
      el.appendChild(label);
      this._modSlotsEl.appendChild(el);
      this._modSlotEls.push(el);
    }
  }

  _updateModSlots() {
    const state = this.game.getState();
    const run = state.run;
    const relics = run ? run.relics : [];

    // First 3 slots unlocked from start, rest unlock at round 3, 5, 7, 9, 11
    const unlockRounds = [1, 1, 1, 3, 5, 7, 9, 11];
    const round = run ? run.round : 0;

    for (let i = 0; i < this._modSlotCount; i++) {
      const el = this._modSlotEls[i];
      const label = el.querySelector('.slot-label');
      const unlocked = round >= unlockRounds[i];
      const relic = relics[i];

      if (!unlocked) {
        el.className = 'mod-slot locked';
        el.innerHTML = '🔒';
        el.appendChild(label);
        label.textContent = `RND ${unlockRounds[i]}`;
      } else if (relic) {
        el.className = 'mod-slot active';
        el.innerHTML = relic.emoji;
        el.appendChild(label);
        label.textContent = relic.name;
        el.title = relic.description;
      } else {
        el.className = 'mod-slot empty';
        el.innerHTML = '+';
        el.appendChild(label);
        label.textContent = `SLOT ${i + 1}`;
      }
    }
  }

  _positionModSlots() {
    // Position slots in a circle around the wheel center
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2;
    const cy = H / 2;
    // Orbit radius = slightly bigger than wheel visual radius
    const canvasR = Math.min(480, 320) * 0.48; // internal canvas R
    const scaleX = W / 480;
    const scaleY = H / 320;
    const orbitR = canvasR * Math.min(scaleX, scaleY) * 0.75;

    for (let i = 0; i < this._modSlotCount; i++) {
      const angle = (i / this._modSlotCount) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * orbitR;
      const y = cy + Math.sin(angle) * orbitR;
      this._modSlotEls[i].style.left = x + 'px';
      this._modSlotEls[i].style.top = y + 'px';
    }
  }

  // ── UI ──
  _updateUI() {
    const state = this.game.getState();
    const phase = state.phase;
    const run = state.run;

    if (run) this._updateHUD(run);
    this._btn.disabled = false;

    switch (phase) {
      case 'IDLE':
        this._btn.textContent = 'SPIN';
        this._btn.className = 'nes-btn is-primary';
        this._hint.textContent = '';
        this._overlay.classList.remove('active');
        break;
      case 'RESULTS':
        this._showResults(run);
        this._btn.textContent = 'CONTINUE';
        this._btn.className = 'nes-btn is-success';
        this._hint.textContent = '';
        break;
      case 'CHOICE':
        this._showChoices(run);
        this._btn.textContent = 'SKIP';
        this._btn.className = 'nes-btn is-warning';
        this._hint.textContent = '';
        break;
      case 'SHOP':
        this._showShop(run);
        this._btn.textContent = 'LEAVE';
        this._btn.className = 'nes-btn';
        this._hint.textContent = '';
        break;
      case 'GAME_OVER':
        this._showGameOver(run, state);
        this._btn.textContent = 'MENU';
        this._btn.className = 'nes-btn is-error';
        this._hint.textContent = '';
        break;
      case 'VICTORY':
        this._showVictory(run, state);
        this._btn.textContent = 'MENU';
        this._btn.className = 'nes-btn is-success';
        this._hint.textContent = '';
        break;
    }
  }

  _updateHUD(run) {
    this._hudRound.textContent = `${run.round}/${BALANCE.ROUNDS_PER_RUN}`;
    this._hudQuota.textContent = String(getQuota(run.round));
    this._hudScore.textContent = String(run.score);
    const filled = '<i class="nes-icon is-small heart"></i>'.repeat(run.ballsLeft);
    const empty = '<i class="nes-icon is-small heart is-empty"></i>'.repeat(BALANCE.BALLS_PER_ROUND - run.ballsLeft);
    this._hudBalls.innerHTML = filled + empty;
  }

  _flash(text) {
    this._winNotif.textContent = text;
    this._winNotif.classList.add('active');
    clearTimeout(this._flashTimeout);
    this._flashTimeout = setTimeout(() => this._winNotif.classList.remove('active'), 1200);
  }

  _showResults(run) {
    const r = run.lastRoundResult;
    let html = `<h2 class="${r.passed ? '' : 'fail'}">${r.passed ? '✓ ROUND PASSED' : '✕ QUOTA FAILED'}</h2>`;
    for (const sr of run.spinResults) {
      html += `<div class="result-row"><span class="emoji">${sr.symbol.emoji}</span><span>${sr.symbol.name}</span><span class="val">+${sr.value}</span></div>`;
    }
    html += `<div class="summary">TOTAL <span class="gold">${r.totalWon}</span> / QUOTA <span class="gold">${r.quota}</span>${r.passed && r.shopCoins > 0 ? `<br>+${r.shopCoins} 💵` : ''}</div>`;
    this._overlay.innerHTML = html;
    this._overlay.classList.add('active');

    if (r.passed) this._playWinFanfare(); else this._playLose();
  }

  _showChoices(run) {
    let html = '<h2 class="gold">CHOOSE UPGRADE</h2><div class="card-row">';
    run.currentChoices.forEach((c, i) => {
      html += `<div class="nes-container is-dark game-card" data-idx="${i}"><div class="emoji">${c.emoji}</div><div class="name">${c.name}</div><div class="desc">${c.description}</div></div>`;
    });
    html += '</div>';
    this._overlay.innerHTML = html;
    this._overlay.classList.add('active');
    this._overlay.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        const c = run.currentChoices[idx];
        if (c.type === 'add_symbol' || c.type === 'upgrade') this.game.makeChoice(idx);
        else this.game.makeChoice(idx, 0);
        this._playSelect();
        this._updateUI();
      });
    });
  }

  _showShop(run) {
    let html = `<h2 class="gold">⚒ THE FORGE ⚒</h2><p style="font-size:9px;color:#92cc41">💵 ${run.shopCurrency} available</p><div class="card-row">`;
    run.shopOfferings.forEach((o, i) => {
      const afford = run.shopCurrency >= o.finalCost;
      html += `<div class="nes-container is-dark game-card ${afford ? '' : 'locked'}" data-idx="${i}"><div class="emoji">${o.emoji}</div><div class="name">${o.name}</div><div class="desc">${o.description}</div><div class="cost">${o.finalCost} 💵</div></div>`;
    });
    html += '</div>';
    this._overlay.innerHTML = html;
    this._overlay.classList.add('active');
    this._overlay.querySelectorAll('.game-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        this.game.shopBuyRelic(parseInt(card.dataset.idx));
        this._playCoin();
        this._showShop(this.game.getState().run);
      });
    });
  }

  _showGameOver(run, state) {
    this._overlay.innerHTML = `<h2 class="fail">GAME OVER</h2><p style="font-size:9px">Round ${run.round} — Score ${run.score}</p><p style="font-size:9px;color:#f7d51d">⭐ ${state.meta.totalStars} stars</p>`;
    this._overlay.classList.add('active');
  }

  _showVictory(run, state) {
    this._overlay.innerHTML = `<h2 class="gold">🏆 VICTORY 🏆</h2><p style="font-size:9px">Score ${run.score}</p><p style="font-size:9px;color:#f7d51d">⭐ ${state.meta.totalStars} stars</p>`;
    this._overlay.classList.add('active');
  }

  _pop(text, emoji) {
    const el = document.createElement('div');
    el.className = 'pop'; el.innerHTML = `${emoji} ${text}`;
    el.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 100) + 'px';
    el.style.top = '40%';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
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
    // Force kill after fade
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

  _loop(time) {
    requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((time - this._lastTime) / 1000, 0.05);
    this._lastTime = time;
    this.wheel.update(dt);
    this.wheel.draw();
  }
}

window.addEventListener('DOMContentLoaded', () => new App());
