import { BET_TYPES } from '../../src/data/bets.js';
import { BALANCE, getQuota } from '../../src/data/balance.js';

/**
 * Full HTML/CSS game UI — manages all screens, zero keyboard required.
 */
export class GameUI {
  constructor(root, game, audio) {
    this.root = root;
    this.game = game;
    this.audio = audio;
    this._wager = 10;
    this._toastTimer = null;
    this._selectedBetType = null;

    // Initial render
    this.render();
  }

  render() {
    const phase = this.game.getPhase();
    const state = this.game.getState();
    const run = state.run;

    this.root.innerHTML = '';

    // Always show topbar when in a run
    if (run) this._renderTopbar(run, phase);

    switch (phase) {
      case 'IDLE':        this._renderTitle(); break;
      case 'BETTING':     this._renderBetting(run); break;
      case 'SPINNING':
      case 'RESOLVING':   this._renderSpinning(run); break;
      case 'RESULTS':     this._renderResults(run); break;
      case 'CHOICE':      this._renderChoice(run); break;
      case 'SHOP':        this._renderShop(run); break;
      case 'GAME_OVER':   this._renderEndgame(state, false); break;
      case 'VICTORY':     this._renderEndgame(state, true); break;
    }

    // Relics bar
    if (run && run.relics.length > 0) this._renderRelics(run);

    // Fever overlay
    if (run?.fever?.active) {
      const fever = document.createElement('div');
      fever.className = 'fever-overlay';
      fever.textContent = '🔥 FEVER 🔥';
      this.root.appendChild(fever);
    }
  }

  toast(text, isLoss = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isLoss ? ' loss' : '');
    el.textContent = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ── Title ──
  _renderTitle() {
    const screen = this._el('div', 'screen-title');
    screen.innerHTML = `
      <h1>SPINFORGE</h1>
      <div class="subtitle">Mystic Roulette Roguelike</div>
    `;
    const btn = this._el('button', 'btn-start');
    btn.textContent = 'Tourner la roue';
    btn.onclick = () => {
      this.audio.init();
      this.audio.play('click');
      this.game.startRun();
    };
    screen.appendChild(btn);
    this.root.appendChild(screen);
  }

  // ── Topbar ──
  _renderTopbar(run, phase) {
    const bar = this._el('div', 'topbar');
    const quota = run.lastRoundResult?.quota ?? getQuota(run.round);
    bar.innerHTML = `
      <div class="topbar-left">
        <div class="round-badge">Round ${run.round} / ${BALANCE.ROUNDS_PER_RUN}</div>
        <div class="quota-badge">Quota: ${quota}</div>
      </div>
      <div class="topbar-right">
        <div class="stat-box chips"><span class="icon">🪙</span><span class="val">${run.chips}</span></div>
        <div class="stat-box currency"><span class="icon">💵</span><span class="val">${run.shopCurrency}</span></div>
        <div class="stat-box score"><span class="icon">⭐</span><span class="val">${run.score}</span></div>
      </div>
    `;
    this.root.appendChild(bar);
  }

  // ── Betting ──
  _renderBetting(run) {
    const panel = this._el('div', 'betting-panel');

    // Active bets
    const activeBets = this._el('div', 'active-bets');
    run.bets.forEach((b, i) => {
      const chip = this._el('div', 'active-bet-chip');
      const betDef = BET_TYPES.find(bt => bt.id === b.betTypeId);
      chip.innerHTML = `${betDef?.emoji ?? '?'} ${b.wager} <span class="remove" data-idx="${i}">✕</span>`;
      chip.querySelector('.remove').onclick = (e) => {
        e.stopPropagation();
        this.audio.play('click');
        this.game.removeBet(i);
      };
      activeBets.appendChild(chip);
    });
    panel.appendChild(activeBets);

    // Bet type buttons
    const betRow = this._el('div', 'bet-row');
    const available = BET_TYPES.filter(b => b.startsUnlocked && b.minRound <= run.round);
    for (const bt of available) {
      const btn = this._el('div', 'bet-btn');
      btn.innerHTML = `
        <span class="emoji">${bt.emoji}</span>
        <span class="name">${bt.name}</span>
        <span class="payout">x${bt.payout}</span>
      `;
      btn.onclick = () => {
        this.audio.init();
        this.audio.play('chip');
        this.game.placeBet(bt.id, this._wager);
      };
      betRow.appendChild(btn);
    }
    panel.appendChild(betRow);

    // Wager row
    const wagerRow = this._el('div', 'wager-row');
    for (const val of [5, 10, 25]) {
      const btn = this._el('button', 'wager-btn' + (this._wager === val ? ' selected' : ''));
      btn.textContent = `${val} 🪙`;
      btn.onclick = () => {
        this._wager = val;
        this.audio.play('click');
        this.render();
      };
      wagerRow.appendChild(btn);
    }
    // All-in button
    const allIn = this._el('button', 'wager-btn' + (this._wager === run.chips ? ' selected' : ''));
    allIn.textContent = 'ALL IN';
    allIn.onclick = () => {
      this._wager = run.chips;
      this.audio.play('click');
      this.render();
    };
    wagerRow.appendChild(allIn);
    panel.appendChild(wagerRow);

    // Spins left + Spin button
    const bottomRow = this._el('div', 'wager-row');
    const spinsLabel = this._el('div', 'spins-left');
    spinsLabel.innerHTML = `Spins restants: <span>${run.spinsLeft}</span>`;
    bottomRow.appendChild(spinsLabel);

    const spinBtn = this._el('button', 'spin-btn');
    spinBtn.textContent = 'SPIN';
    spinBtn.disabled = run.bets.length === 0;
    spinBtn.onclick = () => {
      this.audio.init();
      this.game.spin();
    };
    bottomRow.appendChild(spinBtn);
    panel.appendChild(bottomRow);

    this.root.appendChild(panel);
  }

  // ── Spinning (just show "spinning" state, panel hidden) ──
  _renderSpinning(run) {
    // Don't show betting panel — wheel is spinning
  }

  // ── Results ──
  _renderResults(run) {
    const r = run.lastRoundResult;
    if (!r) return;

    const screen = this._el('div', 'screen-results');
    const card = this._el('div', 'results-card');

    card.innerHTML = `
      <h2 class="${r.passed ? 'passed' : 'failed'}">${r.passed ? '✨ Round réussi!' : '💀 Quota non atteint'}</h2>
      <div class="results-row"><span class="label">Gains totaux</span><span class="value gold">${r.totalWon} 🪙</span></div>
      <div class="results-row"><span class="label">Quota</span><span class="value">${r.quota}</span></div>
      <div class="results-row"><span class="label">Surplus</span><span class="value green">+${r.surplus}</span></div>
      <div class="results-row"><span class="label">Monnaie gagnée</span><span class="value green">+${r.shopCoins} 💵</span></div>
    `;

    if (r.passed) {
      const btn = this._el('button', 'btn-continue');
      btn.textContent = 'Continuer';
      btn.onclick = () => {
        this.audio.play('click');
        this.game.continueFromResults();
      };
      card.appendChild(btn);
    } else {
      // Game over is already triggered automatically
    }

    screen.appendChild(card);
    this.root.appendChild(screen);
  }

  // ── Choice (1 of 3) ──
  _renderChoice(run) {
    const screen = this._el('div', 'screen-choice');
    const title = this._el('div', 'choice-title');
    title.textContent = '🎴 Choisis une amélioration';
    screen.appendChild(title);

    const cards = this._el('div', 'choice-cards');
    run.currentChoices.forEach((c, i) => {
      const card = this._el('div', 'choice-card');
      card.innerHTML = `
        <div class="type-badge">${c.type.replace('_', ' ')}</div>
        <div class="emoji">${c.emoji}</div>
        <div class="name">${c.name}</div>
        <div class="desc">${c.description}</div>
      `;
      card.onclick = () => {
        this.audio.play('click');
        // For add_symbol or upgrade, no target needed
        if (c.type === 'add_symbol' || c.type === 'upgrade') {
          this.game.makeChoice(i);
        } else {
          // remove / boost need a target — auto-pick first valid
          this.game.makeChoice(i, 0);
        }
      };
      cards.appendChild(card);
    });
    screen.appendChild(cards);

    const skip = this._el('button', 'btn-skip');
    skip.textContent = 'Passer';
    skip.onclick = () => {
      this.audio.play('click');
      this.game.skipChoice();
    };
    screen.appendChild(skip);

    this.root.appendChild(screen);
  }

  // ── Shop ──
  _renderShop(run) {
    const screen = this._el('div', 'screen-shop');

    const title = this._el('div', 'shop-title');
    title.textContent = '⚒️ LA FORGE';
    screen.appendChild(title);

    const currency = this._el('div', 'shop-currency');
    currency.textContent = `💵 ${run.shopCurrency} disponible`;
    screen.appendChild(currency);

    // Offerings
    const offerings = this._el('div', 'shop-offerings');
    run.shopOfferings.forEach((o, i) => {
      const tooExpensive = run.shopCurrency < o.finalCost;
      const card = this._el('div', 'relic-card' + (tooExpensive ? ' too-expensive' : ''));
      card.innerHTML = `
        <div class="emoji">${o.emoji}</div>
        <div class="name">${o.name}</div>
        <div class="desc">${o.description}</div>
        <div class="cost">${o.finalCost} 💵</div>
      `;
      if (!tooExpensive) {
        card.onclick = () => {
          this.audio.play('click');
          this.game.shopBuyRelic(i);
        };
      }
      offerings.appendChild(card);
    });
    screen.appendChild(offerings);

    // Actions
    const actions = this._el('div', 'shop-actions');

    const rerollCost = BALANCE.SHOP_REROLL_BASE + run.rerollCount * BALANCE.SHOP_REROLL_INCREMENT;
    const reroll = this._el('button', 'btn-reroll');
    reroll.textContent = `Reroll (${rerollCost} 💵)`;
    reroll.onclick = () => {
      this.audio.play('click');
      this.game.shopReroll();
    };
    if (run.shopCurrency < rerollCost) reroll.style.opacity = '0.4';
    actions.appendChild(reroll);

    const leave = this._el('button', 'btn-leave');
    leave.textContent = 'Prochain round';
    leave.onclick = () => {
      this.audio.play('click');
      this.game.endShop();
    };
    actions.appendChild(leave);

    screen.appendChild(actions);
    this.root.appendChild(screen);
  }

  // ── Endgame ──
  _renderEndgame(state, won) {
    const screen = this._el('div', 'screen-endgame');
    const card = this._el('div', 'endgame-card');

    const run = state.run;
    const stars = state.meta.totalStars;

    card.innerHTML = `
      <h1 class="${won ? 'victory' : 'gameover'}">${won ? '🏆 VICTOIRE' : '💀 GAME OVER'}</h1>
      <div class="stars">${'⭐'.repeat(Math.min(stars, 20))}</div>
      <div class="final-score">Score: ${run?.score ?? 0} — Round ${run?.round ?? 0} / ${BALANCE.ROUNDS_PER_RUN}</div>
    `;

    const btn = this._el('button', 'btn-start');
    btn.textContent = 'Rejouer';
    btn.style.marginTop = '24px';
    btn.onclick = () => {
      this.audio.play('click');
      this.game.startRun();
    };
    card.appendChild(btn);

    screen.appendChild(card);
    this.root.appendChild(screen);
  }

  // ── Relics bar ──
  _renderRelics(run) {
    const bar = this._el('div', 'relics-bar');
    for (const r of run.relics) {
      const icon = this._el('div', 'relic-icon');
      icon.textContent = r.emoji;
      icon.title = `${r.name}: ${r.description}`;
      bar.appendChild(icon);
    }
    this.root.appendChild(bar);
  }

  // ── Helper ──
  _el(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }
}
