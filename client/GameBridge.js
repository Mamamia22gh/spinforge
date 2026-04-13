import { BALANCE } from '../src/data/balance.js';
import { PopupUI } from './ui/PopupUI.js';

/**
 * Bridge between game logic, machine interactions, and 3D scene.
 * Lever = spin wheel with real ball physics. Ball landing determines outcome.
 */
export class GameBridge {
  constructor(game, arcadeScene, audio) {
    this.game = game;
    this.scene = arcadeScene;
    this.crt = arcadeScene.crt;
    this.machine = arcadeScene.machine;
    this.audio = audio;
    this.ui = new PopupUI();

    this._spinning = false;
    this._choiceIndex = -1;
    this._setupGameEvents();

    // Show wheel + balls immediately (before any run starts)
    this._showDefaultWheel();
  }

  _showDefaultWheel() {
    const { INITIAL_WHEEL } = BALANCE;
    const defaultWheel = INITIAL_WHEEL.map((symbolId, i) => ({
      id: 'preview_' + i,
      symbolId,
      weight: 1,
      modifiers: [],
    }));
    this.crt.wheel.updateWheel(defaultWheel);
    this.crt.wheel.placeBalls(BALANCE.BALLS_PER_ROUND);
  }

  // ── Called by main.js when player clicks a machine part ──
  handleAction(action) {
    this.audio.init();
    const phase = this.game.getPhase();
    const state = this.game.getState();

    switch (phase) {
      case 'IDLE':
        if (action === 'lever' || action === 'coin_slot') {
          if (!state.run) {
            this.audio.play('click');
            this.machine.pullLever();
            this.game.startRun();
            this._startSpinSequence();
          } else {
            this.audio.play('click');
            this.machine.pullLever();
            this._startSpinSequence();
          }
        }
        break;

      case 'GAME_OVER':
      case 'VICTORY':
        if (action === 'lever' || action === 'coin_slot') {
          this.audio.play('click');
          this.machine.pullLever();
          this.ui.clearCenter();
          this.game.startRun();
          this._startSpinSequence();
        }
        break;

      case 'SPINNING':
        break;

      case 'RESULTS':
        if (action === 'lever') {
          this.audio.play('click');
          this.machine.pullLever();
          this.ui.clearCenter();
          this.game.continueFromResults();
        }
        break;

      case 'CHOICE':
        this._handleChoice(action, state.run);
        break;

      case 'SHOP':
        this._handleShop(action, state.run);
        break;
    }
  }

  // ── Spin sequence: ONE big spin, all balls launched during it ──
  async _startSpinSequence() {
    if (this._spinning) return;
    this._spinning = true;

    this.audio.play('spin');
    this.ui.clearCenter();

    const run = this.game.getState().run;
    this.ui.showHUD(run);

    // Place balls on the wheel
    this.crt.wheel.placeBalls(run.ballsLeft);

    // Wait a beat so player sees balls placed
    await this._delay(800);

    // Start rolling sound loop
    this._spinSoundInterval = setInterval(() => {
      this.audio.updateSpinSound(this.crt.wheel.wheelSpeed);
    }, 50);

    // Spin! All balls fly at once. Wait for ALL to settle.
    const segmentIndices = await this.crt.wheel.startSpin();

    // Stop rolling sound
    clearInterval(this._spinSoundInterval);
    this.audio.updateSpinSound(0);

    // Resolve each ball result with segment highlight
    for (let i = 0; i < segmentIndices.length; i++) {
      const result = this.game.resolveBallAt(segmentIndices[i]);
      if (!result) continue;

      // Highlight the segment on the wheel
      this.crt.wheel.highlightSegment(segmentIndices[i]);

      this.ui.popValue(result.value, result.result.symbol);
      this.ui.updateScore(this.game.getState().run.score);
      this.ui.updateBalls(this.game.getState().run.ballsLeft, BALANCE.BALLS_PER_ROUND);
      this.audio.play(result.value > 20 ? 'win' : 'chip');

      // Drop coins proportional to this ball's value
      const ballCoins = Math.max(1, Math.floor(result.value / 15));
      this.scene.triggerWin(ballCoins);

      // Stagger the popups
      if (i < segmentIndices.length - 1) {
        await this._delay(300);
      }
    }

    this._spinning = false;

    // After all balls — check results
    const state = this.game.getState();
    if (state.phase === 'RESULTS') {
      const r = state.run.lastRoundResult;
      if (r.passed) {
        // Big coin cascade for passing
        const bonusCoins = Math.min(
          BALANCE.MAX_COIN_DROP,
          Math.max(5, Math.floor(r.surplus / BALANCE.COINS_PER_SURPLUS)),
        );
        this.scene.triggerWin(bonusCoins);
        this.audio.play('jackpot');
      } else {
        this.audio.play('lose');
      }

      // Show results after a beat
      await this._delay(800);
      this.ui.showResults(state.run);
    }
  }

  _handleChoice(action, run) {
    if (action !== 'lever') return;

    const choices = run.currentChoices;
    this._choiceIndex = (this._choiceIndex ?? -1) + 1;

    if (this._choiceIndex >= choices.length) {
      this.audio.play('click');
      this.machine.pullLever();
      this.ui.clearCenter();
      this.game.skipChoice();
      this._choiceIndex = -1;
      return;
    }

    this.audio.play('click');
    this.machine.pullLever();
    const c = choices[this._choiceIndex];
    if (c.type === 'add_symbol' || c.type === 'upgrade') {
      this.game.makeChoice(this._choiceIndex);
    } else {
      this.game.makeChoice(this._choiceIndex, 0);
    }
    this._choiceIndex = -1;
  }

  _handleShop(action, run) {
    if (action !== 'lever') return;

    const offerings = run.shopOfferings;
    if (offerings.length > 0) {
      const idx = offerings.findIndex(o => run.shopCurrency >= o.finalCost);
      if (idx >= 0) {
        this.audio.play('click');
        this.machine.pullLever();
        this.game.shopBuyRelic(idx);
        // Refresh shop UI
        this.ui.clearCenter();
        this.ui.showShop(this.game.getState().run);
        return;
      }
    }

    this.audio.play('click');
    this.machine.pullLever();
    this.ui.clearCenter();
    this.game.endShop();
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Game events → visual feedback ──
  _setupGameEvents() {
    // Peg hit → tick sound
    this.crt.wheel.onPegHit = () => {
      this.audio.play('tick');
    };

    this.game.on('run:started', () => {
      const state = this.game.getState();
      this.crt.wheel.updateWheel(state.run.wheel);
      this.crt.wheel.placeBalls(state.run.ballsLeft);
      this.ui.showHUD(state.run);
    });

    this.game.on('round:preview', (data) => {
      this.crt.wheel.updateWheel(data.wheel);
      this.crt.wheel.resetBalls();
      this.crt.wheel.placeBalls(data.ballsLeft);
      const state = this.game.getState();
      this.ui.showHUD(state.run);
      this.ui.clearCenter();
    });

    this.game.on('fever:started', () => {
      this.audio.play('fever');
      this.scene.triggerFever();
      this.ui.popFever();
    });

    this.game.on('choice:presented', ({ choices }) => {
      this.ui.showChoices(choices);
    });

    this.game.on('shop:opened', () => {
      const state = this.game.getState();
      this.ui.showShop(state.run);
    });

    this.game.on('game:won', () => {
      this.audio.play('jackpot');
      this.scene.triggerWin(BALANCE.MAX_COIN_DROP);
      this.ui.hideHUD();
      this.ui.popTitle('🏆 VICTORY! 🏆', 'pop-win', 5000);
    });

    this.game.on('game:over', ({ round, score }) => {
      this.ui.hideHUD();
      this.ui.popTitle('GAME OVER', 'pop-lose', 5000);
      this.ui.popSubtitle(`Round ${round} — Score ${score}`, 600);
    });
  }
}
