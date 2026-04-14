import { BALANCE, getQuota } from '../../src/data/balance.js';
import '../styles/popup.css';

/**
 * Casino-style HTML popup UI — all game info as satisfying animated overlays.
 */
export class PopupUI {
  constructor() {
    this._container = document.createElement('div');
    this._container.id = 'popup-ui';
    this._container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;font-family:"Rajdhani",sans-serif;';
    document.body.appendChild(this._container);

    // Persistent HUD elements
    this._hud = this._el('div', 'hud');
    this._roundEl = this._el('div', 'hud-round');
    this._scoreEl = this._el('div', 'hud-score');
    this._ballsEl = this._el('div', 'hud-balls');
    this._quotaEl = this._el('div', 'hud-quota');
    this._hud.append(this._roundEl, this._quotaEl, this._scoreEl, this._ballsEl);
    this._container.appendChild(this._hud);
    this._hud.style.display = 'none';

    // Center popup area
    this._center = this._el('div', 'center-popup');
    this._container.appendChild(this._center);

    this._displayScore = 0;
    this._targetScore = 0;
    this._animFrame = null;
    this._startScoreTick();
  }

  _el(tag, cls) {
    const el = document.createElement(tag);
    el.className = cls;
    return el;
  }

  // ── HUD Updates ──

  showHUD(run) {
    this._hud.style.display = '';
    this._roundEl.textContent = `ROUND ${run.round}`;
    this._quotaEl.textContent = `QUOTA ${getQuota(run.round)}`;
    this._targetScore = run.score;
    this._ballsEl.textContent = `⚪`.repeat(run.ballsLeft) + `⚫`.repeat(BALANCE.BALLS_PER_ROUND - run.ballsLeft);
  }

  hideHUD() {
    this._hud.style.display = 'none';
  }

  updateScore(score) {
    this._targetScore = score;
  }

  updateBalls(left, total) {
    this._ballsEl.textContent = `⚪`.repeat(left) + `⚫`.repeat(total - left);
  }

  _startScoreTick() {
    const tick = () => {
      if (this._displayScore < this._targetScore) {
        const diff = this._targetScore - this._displayScore;
        this._displayScore += Math.max(1, Math.ceil(diff * 0.15));
        if (this._displayScore > this._targetScore) this._displayScore = this._targetScore;
        this._scoreEl.textContent = this._displayScore.toString();
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ── Value Popup (when ball lands) ──

  popValue(value, symbol) {
    const el = this._el('div', 'pop-value');
    el.innerHTML = `<span class="pop-emoji">${symbol.emoji}</span> <span class="pop-num">+${value}</span>`;
    const offsetX = (Math.random() - 0.5) * 120;
    el.style.left = `calc(50% + ${offsetX}px)`;
    this._container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  // ── Big Center Popups ──

  popTitle(text, cls = '', duration = 2500) {
    const el = this._el('div', 'pop-title ' + cls);
    el.textContent = text;
    this._center.innerHTML = '';
    this._center.appendChild(el);
    setTimeout(() => el.classList.add('pop-fade'), duration - 500);
    setTimeout(() => el.remove(), duration);
  }

  popSubtitle(text, delay = 0) {
    setTimeout(() => {
      const el = this._el('div', 'pop-subtitle');
      el.textContent = text;
      this._center.appendChild(el);
      setTimeout(() => el.classList.add('pop-fade'), 2000);
      setTimeout(() => el.remove(), 2500);
    }, delay);
  }

  // ── Streak / Fever ──

  popStreak(count) {
    const el = this._el('div', 'pop-streak');
    el.textContent = `STREAK ×${count}`;
    this._container.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  popFever() {
    const el = this._el('div', 'pop-fever');
    el.textContent = '🔥 FEVER 🔥';
    this._container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ── Round Results ──

  showResults(run) {
    const r = run.lastRoundResult;
    this._center.innerHTML = '';

    // Title
    const title = this._el('div', r.passed ? 'pop-title pop-win' : 'pop-title pop-lose');
    title.textContent = r.passed ? '✓ ROUND PASSED' : '✕ QUOTA FAILED';
    this._center.appendChild(title);

    // Ball results stagger in
    const results = run.spinResults;
    results.forEach((sr, i) => {
      setTimeout(() => {
        const row = this._el('div', 'pop-result-row');
        const coins = Math.max(1, Math.floor(sr.value / 15));
        row.innerHTML = `<span class="pop-emoji">${sr.symbol.emoji}</span> <span>${sr.symbol.name}</span> <span class="pop-num">+${sr.value}</span> <span class="pop-coins">${'🪙'.repeat(Math.min(coins, 5))}</span>`;
        this._center.appendChild(row);
      }, 300 + i * 200);
    });

    // Summary with total coins
    setTimeout(() => {
      const summary = this._el('div', 'pop-summary');
      summary.innerHTML = `TOTAL <span class="gold">${r.totalWon}</span> / QUOTA <span class="gold">${r.quota}</span>`;
      if (r.passed && r.shopCoins > 0) {
        summary.innerHTML += ` — <span class="green">+${r.shopCoins}💵</span>`;
      }
      this._center.appendChild(summary);

      // Total coins earned animation
      const totalCoins = results.reduce((s, sr) => s + Math.max(1, Math.floor(sr.value / 15)), 0);
      const coinLine = this._el('div', 'pop-coin-total');
      coinLine.innerHTML = `<span class="coin-spin">🪙</span> <span class="gold">${totalCoins} coins</span>`;
      this._center.appendChild(coinLine);
    }, 300 + results.length * 200 + 300);
  }

  // ── Choices ──

  showChoices(choices) {
    this._center.innerHTML = '';
    const title = this._el('div', 'pop-title');
    title.textContent = 'CHOOSE YOUR UPGRADE';
    this._center.appendChild(title);

    const row = this._el('div', 'choice-row');
    choices.forEach((c, i) => {
      setTimeout(() => {
        const card = this._el('div', 'choice-card');
        card.innerHTML = `
          <div class="choice-emoji">${c.emoji}</div>
          <div class="choice-name">${c.name}</div>
          <div class="choice-desc">${c.description}</div>
          <div class="choice-key">${i + 1}</div>
        `;
        row.appendChild(card);
      }, i * 150);
    });
    this._center.appendChild(row);

    const hint = this._el('div', 'pop-hint');
    hint.textContent = 'LEVER = skip';
    this._center.appendChild(hint);
  }

  // ── Shop ──

  showShop(run, tickets) {
    this._clearShopBackdrop();
    this._center.innerHTML = '';
    this._center.classList.add('shop-mode');

    // Full-screen checkerboard backdrop
    this._shopBg = document.createElement('div');
    this._shopBg.className = 'shop-backdrop';
    this._container.insertBefore(this._shopBg, this._center);

    const title = this._el('div', 'pop-title pop-purple');
    title.textContent = '⚒ THE FORGE ⚒';
    this._center.appendChild(title);

    const currency = this._el('div', 'pop-subtitle');
    currency.innerHTML = `🎟️ <span class="gold">${tickets}</span> available`;
    this._center.appendChild(currency);

    const row = this._el('div', 'shop-row');
    run.shopOfferings.forEach((o, i) => {
      setTimeout(() => {
        const afford = tickets >= o.finalCost;
        const card = this._el('div', 'shop-card' + (afford ? '' : ' shop-locked'));
        card.innerHTML = `
          <div class="shop-emoji">${o.emoji}</div>
          <div class="shop-name">${o.name}</div>
          <div class="shop-desc">${o.description}</div>
          <div class="shop-cost">${o.finalCost} 💵</div>
        `;
        row.appendChild(card);
      }, i * 100);
    });
    this._center.appendChild(row);

    const hint = this._el('div', 'pop-hint');
    hint.textContent = 'LEVER = buy / leave';
    this._center.appendChild(hint);
  }

  clearCenter() {
    this._clearShopBackdrop();
    this._center.innerHTML = '';
  }

  _clearShopBackdrop() {
    this._center.classList.remove('shop-mode');
    if (this._shopBg) { this._shopBg.remove(); this._shopBg = null; }
  }
}
