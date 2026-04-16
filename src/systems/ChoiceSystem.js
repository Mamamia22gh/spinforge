import { CHOICES } from '../data/choices.js';
import { BALANCE } from '../data/balance.js';
import { uid } from '../core/GameState.js';
import { WHEEL_UPGRADE_MAP } from '../data/wheelUpgrades.js';

/**
 * Generates and applies between-round choices.
 */
export class ChoiceSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Generate 3 random choices for the player.
   * @param {object} run
   * @param {object} meta
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {object[]}
   */
  generate(run, meta, rng) {
    const available = CHOICES.filter(c => this.#isAvailable(c, run, meta));
    if (available.length === 0) return [];

    const count = Math.min(3, available.length);
    const chosen = [];
    const usedIds = new Set();
    const usedTypes = new Set();

    for (let i = 0; i < count; i++) {
      let remaining = available.filter(c => !usedIds.has(c.id));
      if (remaining.length === 0) break;

      // Type diversity
      const diverse = remaining.filter(c => !usedTypes.has(c.type));
      if (diverse.length > 0) remaining = diverse;

      const weights = remaining.map(c => c.weight);
      const pick = rng.pickWeighted(remaining, weights);
      chosen.push({ ...pick, instanceId: uid('choice') });
      usedIds.add(pick.id);
      usedTypes.add(pick.type);
    }

    return chosen;
  }

  /**
   * Apply a chosen option.
   * @param {object} run
   * @param {object} choice
   * @param {number|null} targetIndex — for remove/boost (segment index)
   * @param {import('../systems/WheelSystem.js').WheelSystem} wheelSystem
   * @returns {boolean}
   */
  apply(run, choice, targetIndex, wheelSystem) {
    switch (choice.type) {
      case 'wheel_upgrade': {
        const upg = WHEEL_UPGRADE_MAP.get(choice.payload.upgradeId);
        if (upg) (run.purchasedUpgrades = run.purchasedUpgrades || []).push({ ...upg });
        return true;
      }
      case 'add_symbol':
        return wheelSystem.addSegment(run, choice.payload.symbolId);

      case 'remove_symbol':
        if (targetIndex == null) {
          this.#events.emit('choice:needs_target', { choice });
          return false;
        }
        return wheelSystem.removeSegment(run, targetIndex);

      case 'boost_weight':
        if (targetIndex == null) {
          this.#events.emit('choice:needs_target', { choice });
          return false;
        }
        return wheelSystem.boostWeight(run, targetIndex);

      case 'special_ball':
        return this.#addSpecialBall(run, choice);

      default:
        this.#events.emit('error', { message: `Unknown choice type: ${choice.type}` });
        return false;
    }
  }

  #isAvailable(choice, run, meta) {
    if (choice.requiresUnlock && !meta.unlocks.includes(choice.requiresUnlock)) return false;
    if (choice.minRound && run.round < choice.minRound) return false;

    switch (choice.type) {
      case 'add_symbol':
        return run.wheel.length < BALANCE.MAX_SEGMENTS;
      case 'remove_symbol':
        return run.wheel.length > BALANCE.MIN_SEGMENTS;
      case 'boost_weight':
        return run.wheel.some(s => s.weight < BALANCE.MAX_WEIGHT_PER_SEGMENT);
      default:
        return true;
    }
  }

  #addSpecialBall(run, choice) {
    run.specialBalls.push({
      id: choice.id,
      name: choice.name,
      effect: choice.effect,
      rarity: choice.rarity || 'common',
    });
    run.ballsLeft++;
    this.#events.emit('special_ball:added', {
      ball: choice,
      totalSpecial: run.specialBalls.length,
      ballsLeft: run.ballsLeft,
    });
    return true;
  }
}
