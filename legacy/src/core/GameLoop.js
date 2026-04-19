import { EventBus } from './EventBus.js';
import { RNG } from './RNG.js';
import { createGameState, createRunState, PHASE } from './GameState.js';
import { BALANCE, getQuota } from '../data/balance.js';
import { getSymbol } from '../data/symbols.js';
import { WheelSystem } from '../systems/WheelSystem.js';
import { ScoringSystem } from '../systems/ScoringSystem.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { ChoiceSystem } from '../systems/ChoiceSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { MetaSystem } from '../systems/MetaSystem.js';

/**
 * Main game orchestrator — owns state, delegates to systems, manages phases.
 * Balls land on segments → value calculated from symbol × weight × modifiers.
 * `spin()` picks randomly (for tests); `resolveBallAt(idx)` accepts physics result.
 */
export class GameLoop {
  constructor(options = {}) {
    this.events = new EventBus();
    this.rng = new RNG(options.seed ?? Date.now());
    this.state = createGameState(this.rng.seed);

    if (options.meta) {
      this.state.meta = { ...this.state.meta, ...options.meta };
    }

    this.wheel = new WheelSystem(this.events);
    this.scoring = new ScoringSystem();
    this.effects = new EffectSystem();
    this.choice = new ChoiceSystem(this.events);
    this.shop = new ShopSystem(this.events);
    this.meta = new MetaSystem(this.events);
  }

  #getMods() {
    return this.effects.compute(this.state.run?.relics ?? []);
  }

  // ─── Lifecycle ───

  startRun() {
    const ok = [PHASE.IDLE, PHASE.GAME_OVER, PHASE.VICTORY];
    if (!ok.includes(this.state.phase)) {
      return this.#error('Cannot start run in phase ' + this.state.phase);
    }

    this.state.run = createRunState();
    this.#setPhase(PHASE.IDLE);
    this.#emitRoundPreview();
    this.events.emit('run:started', { seed: this.rng.seed });
    return true;
  }

  // ─── Spin (RNG-based, for tests / headless) ───

  spin() {
    const ok = [PHASE.IDLE, PHASE.SPINNING];
    if (!ok.includes(this.state.phase)) {
      return this.#error('Cannot spin in phase ' + this.state.phase);
    }

    const run = this.state.run;
    if (!run) return this.#error('No active run');
    if (run.ballsLeft <= 0) {
      this.events.emit('error', { message: 'Plus de billes' });
      return null;
    }

    this.#setPhase(PHASE.SPINNING);
    const result = this.wheel.spin(run, this.rng);
    return this.#recordBall(run, result.segmentIndex);
  }

  // ─── Resolve ball at specific segment (physics-driven) ───

  resolveBallAt(segmentIndex) {
    const ok = [PHASE.IDLE, PHASE.SPINNING];
    if (!ok.includes(this.state.phase)) {
      return this.#error('Cannot resolve ball in phase ' + this.state.phase);
    }

    const run = this.state.run;
    if (!run) return this.#error('No active run');
    if (run.ballsLeft <= 0) return null;

    const segment = run.wheel[segmentIndex];
    if (!segment) return this.#error('Invalid segment index: ' + segmentIndex);

    this.#setPhase(PHASE.SPINNING);
    return this.#recordBall(run, segmentIndex);
  }

  // ─── Shared ball resolution ───

  #recordBall(run, segmentIndex) {
    // Check if this ball is a special ball (special balls fire first)
    // specialBallsFired tracks how many have been used this round (reset each round)
    let specialBall = null;
    if (!run._specialBallsFired) run._specialBallsFired = 0;
    if (run._specialBallsFired < run.specialBalls.length) {
      specialBall = run.specialBalls[run._specialBallsFired];
      run._specialBallsFired++;
    }

    const { segment, symbol, value } = this.#resolveSegment(run, segmentIndex, specialBall);

    const isMiss = BALANCE.MISS_POCKETS.includes(segmentIndex);
    const spinResult = { segmentIndex, segment, symbol, value, specialBall, isMiss };
    run.spinResults.push(spinResult);
    run.score += value;
    run.ballsLeft--;

    // Corruption tick
    run.corruption = Math.min(1, run.corruption + BALANCE.CORRUPTION_PER_SPIN);

    // DDA updates
    const dda = run.dda;
    if (isMiss || value === 0) {
      dda.consecutiveMisses++;
      dda.consecutiveHits = 0;
      dda.frustrationScore = Math.min(1, dda.frustrationScore + 0.15);
      dda.flowScore = Math.max(0, dda.flowScore - 0.2);
    } else {
      dda.consecutiveHits++;
      dda.consecutiveMisses = 0;
      dda.flowScore = Math.min(1, dda.flowScore + 0.15);
      dda.frustrationScore = Math.max(0, dda.frustrationScore - 0.1);
    }
    // Tilt: high when close to quota but failing
    const quota = getQuota(run.round);
    if (run.score >= quota * 0.7 && run.score < quota && run.ballsLeft <= 1) {
      dda.tiltScore = Math.min(1, dda.tiltScore + 0.3);
    } else {
      dda.tiltScore = Math.max(0, dda.tiltScore - 0.05);
    }

    // Ticket ball: award tickets equal to pocket number
    if (specialBall?.effect === 'ticket') {
      const ticketsEarned = segmentIndex + 1;
      this.state.meta.tickets += ticketsEarned;
      this.state.meta.totalTickets = (this.state.meta.totalTickets || 0) + ticketsEarned;
      spinResult.ticketsEarned = ticketsEarned;
      this.events.emit('tickets:earned', { amount: ticketsEarned, total: this.state.meta.tickets });
    }

    // Splash ball: also score adjacent segments
    if (specialBall?.effect === 'splash') {
      const len = run.wheel.length;
      const left = (segmentIndex - 1 + len) % len;
      const right = (segmentIndex + 1) % len;
      const { value: vL } = this.#resolveSegment(run, left, null);
      const { value: vR } = this.#resolveSegment(run, right, null);
      run.score += vL + vR;
      spinResult.splashValue = vL + vR;
      spinResult.value += vL + vR;
    }

    this.events.emit('spin:resolved', {
      result: spinResult,
      value: spinResult.value,
      ballsLeft: run.ballsLeft,
      specialBall,
    });

    if (run.ballsLeft <= 0) {
      this.#endRound();
    }

    return { result: spinResult, value: spinResult.value };
  }

  #resolveSegment(run, segmentIndex, specialBall) {
    const segment = run.wheel[segmentIndex];
    const symbol = segment.symbolId ? getSymbol(segment.symbolId) : null;
    const mods = this.#getMods();

    // Base value: relic override or pocket number (1-indexed)
    let baseVal = mods.setBaseValue !== null ? mods.setBaseValue : (segmentIndex + 1);

    // Corruption penalty: above critical threshold, lose 1 base value
    if (run.corruption > BALANCE.CORRUPTION_CRITICAL) {
      baseVal = Math.max(1, baseVal - 1);
    }

    // Even/odd value bonuses from relics
    if (baseVal % 2 === 0) baseVal += mods.addEven;
    else                   baseVal += mods.addOdd;

    let value = baseVal * segment.weight;

    // Wheel upgrade: value_plus_2
    const upgradeCount = (run.purchasedUpgrades || []).filter(u => u.effect === 'value_plus_2').length;
    if (upgradeCount > 0) value += 2 * upgradeCount;

    // Gold pocket: ×2
    if (BALANCE.GOLD_POCKETS.includes(segmentIndex)) {
      value *= 2;
    }

    // Miss pocket: 0
    if (BALANCE.MISS_POCKETS.includes(segmentIndex)) {
      value = 0;
    }

    // Special ball effects (post-symbol)
    if (specialBall?.effect === 'double') {
      value *= 2;
    } else if (specialBall?.effect === 'critical') {
      value *= 5;
    } else if (specialBall?.effect === 'ticket') {
      value = 0;
    }

    return { segment, symbol, value };
  }

  getSegmentDisplayValues() {
    const run = this.state.run;
    if (!run) return [];
    const mods = this.#getMods();
    return run.wheel.map((seg, i) => {
      let v = mods.setBaseValue !== null ? mods.setBaseValue : (i + 1);
      if (v % 2 === 0) v += mods.addEven;
      else             v += mods.addOdd;
      return v;
    });
  }

  // ─── End of round → Results ───

  #endRound() {
    const run = this.state.run;

    const { totalWon, quota, passed, surplus, shopCoins } = this.scoring.evaluateRound(run);

    run.lastRoundResult = {
      round: run.round,
      totalWon,
      quota,
      passed,
      surplus,
      shopCoins,
    };

    run.shopCurrency += shopCoins;

    if (passed) {
      const earned = BALANCE.TICKETS_PER_ROUND;
      this.state.meta.tickets += earned;
      this.state.meta.totalTickets += earned;
      this.events.emit('tickets:earned', { amount: earned, total: this.state.meta.tickets });

      this.#setPhase(PHASE.RESULTS);
      this.events.emit('round:ended', run.lastRoundResult);
    } else if (!run.freeSpinUsed) {
      // Offer one free spin before game over
      this.#setPhase(PHASE.FREE_SPIN_OFFER);
      this.events.emit('free_spin:offered', { score: totalWon, quota });
    } else {
      this.#setPhase(PHASE.RESULTS);
      this.events.emit('round:ended', run.lastRoundResult);
      this.#gameOver();
    }
  }

  // ─── Free Spin ───

  acceptFreeSpin() {
    if (this.state.phase !== PHASE.FREE_SPIN_OFFER) return false;
    const run = this.state.run;
    run.freeSpinUsed = true;
    run.ballsLeft = 1;
    this.#setPhase(PHASE.IDLE);
    this.events.emit('free_spin:accepted', { ballsLeft: 1 });
    return true;
  }

  declineFreeSpin() {
    if (this.state.phase !== PHASE.FREE_SPIN_OFFER) return false;
    const run = this.state.run;
    run.freeSpinUsed = true;
    this.#setPhase(PHASE.RESULTS);
    this.events.emit('round:ended', run.lastRoundResult);
    this.#gameOver();
    return true;
  }

  // ─── Results → Choice ───

  continueFromResults() {
    if (this.state.phase !== PHASE.RESULTS) return false;

    const run = this.state.run;
    if (!run.lastRoundResult.passed) return false;

    if (run.round >= BALANCE.ROUNDS_PER_RUN) {
      this.#victory();
      return true;
    }

    const choices = this.choice.generate(run, this.state.meta, this.rng);
    run.currentChoices = choices;

    this.#setPhase(PHASE.CHOICE);
    this.events.emit('choice:presented', { choices });
    return true;
  }

  // ─── Choice → Shop ───

  makeChoice(index, targetIndex = null) {
    if (this.state.phase !== PHASE.CHOICE) {
      return this.#error('Not in CHOICE phase');
    }

    const run = this.state.run;
    if (index < 0 || index >= run.currentChoices.length) {
      return this.#error('Invalid choice index');
    }

    const choice = run.currentChoices[index];
    const ok = this.choice.apply(run, choice, targetIndex, this.wheel);
    if (!ok) return false;

    this.events.emit('choice:made', { choice, index });
    this.#openShop();
    return true;
  }

  skipChoice() {
    if (this.state.phase !== PHASE.CHOICE) return false;
    this.#openShop();
    return true;
  }

  #openShop() {
    const run = this.state.run;
    run.shopOfferings = this.shop.generateOfferings(run, this.rng);
    run.rerollCount = 0;

    this.#setPhase(PHASE.SHOP);
    this.events.emit('shop:opened', { tickets: this.state.meta.tickets, offerings: run.shopOfferings });
  }

  // ─── Shop ───

  shopBuyRelic(offeringIndex) {
    return this.shopBuy(offeringIndex);
  }

  shopBuy(slotIndex) {
    if (this.state.phase !== PHASE.SHOP) return this.#error('Not in SHOP');
    return this.shop.buyItem(this.state.run, this.state.meta, slotIndex, this.wheel);
  }

  shopReroll() {
    if (this.state.phase !== PHASE.SHOP) return this.#error('Not in SHOP');
    return this.shop.reroll(this.state.run, this.state.meta, this.rng);
  }

  endShop() {
    if (this.state.phase !== PHASE.SHOP) return false;

    const run = this.state.run;

    run.round++;

    if (run.round > BALANCE.ROUNDS_PER_RUN) {
      this.#victory();
      return true;
    }

    // Deduct quota from accumulated score (surplus carries over to next round)
    if (run.lastRoundResult?.passed) {
      run.score -= run.lastRoundResult.quota;
    }

    // Reset for next round — special balls + generic balls bought carry over
    run._specialBallsFired = 0;
    run.ballsLeft = BALANCE.BALLS_PER_ROUND + run.specialBalls.length + (run.genericBallsBought || 0);
    run.spinResults = [];
    run.shopDiscount = 0;
    run.dda.nearMissesThisRound = 0;

    this.#setPhase(PHASE.IDLE);
    this.#emitRoundPreview();
    return true;
  }

  // ─── End states ───

  #gameOver() {
    const run = this.state.run;
    this.state.meta.lastLostRound = run.round;
    this.#applyRunStats(run);

    this.#setPhase(PHASE.GAME_OVER);
    this.events.emit('game:over', {
      round: run.round,
      score: run.score,
      quota: getQuota(run.round),
      totalWon: run.lastRoundResult?.totalWon ?? 0,
    });
  }

  #victory() {
    const run = this.state.run;
    const bonus = BALANCE.TICKETS_BONUS_WIN;
    this.state.meta.tickets += bonus;
    this.state.meta.totalTickets += bonus;
    this.#applyRunStats(run);

    this.#setPhase(PHASE.VICTORY);
    this.events.emit('game:won', { round: run.round, tickets: bonus, score: run.score });
  }

  #applyRunStats(run) {
    this.state.meta.runsCompleted++;
    this.state.meta.bestRound = Math.max(this.state.meta.bestRound, run.round);
  }

  // ─── Helpers ───

  #setPhase(phase) {
    this.state.phase = phase;
    this.events.emit('phase:changed', { phase });
  }

  #emitRoundPreview() {
    const run = this.state.run;
    this.events.emit('round:preview', {
      round: run.round,
      quota: getQuota(run.round),
      ballsLeft: run.ballsLeft,
      wheel: run.wheel,
      probabilities: this.wheel.getProbabilities(run.wheel),
      relics: run.relics,
    });
  }

  #error(msg) {
    this.events.emit('error', { message: msg });
    return false;
  }
}
