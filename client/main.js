import { createGame } from '../src/index.js';
import { BALANCE, getQuota } from '../src/data/balance.js';
import { PixelWheel } from './objects/PixelWheel.js';
import { PAL, PAL32, SYM_COLORS } from './gfx/PaletteDB.js';
import { drawText, drawTextCentered, drawTextCenteredOutlined, drawTextWrapped, measureText, CHAR_W, CHAR_H } from './gfx/BitmapFont.js';
import { drawSpriteCentered, drawAnimSpriteCentered, drawAnimFrameCentered, getAnimFrameCount, SPRITE_SIZE, TICKET_W, TICKET_H } from './gfx/PixelSprites.js';
import { SYMBOLS, getSymbol } from '../src/data/symbols.js';
import { RELICS } from '../src/data/relics.js';
import { CHOICES } from '../src/data/choices.js';
import { PostFXGL } from './gfx/PostFXGL.js';

// ── Canvas resolution (CSS scales this to viewport with nearest-neighbor) ──
const W = 480, H = 270;
const PX = 2;                          // pixel scale — each art pixel = PX×PX canvas pixels
const CW = W * PX, CH = H * PX;       // canvas resolution (960×540)
const WHEEL_CX = 240, WHEEL_CY = 140;
const IND_ARC_R = 92;             // indicator arc radius (between rim 82 and ring 115)
const IND_ARC_STEP = Math.PI / 11; // ~16.4° between each indicator
const BG_PAD = 4;                      // background oversize for parallax shift

// ── Hieroglyph Ring constants ──
const HIERO_INNER = 174;           // inner radius of hieroglyph ring (13px gap outside ORBIT_OUTER=115)
const HIERO_OUTER = 220;           // outer radius (44px height — enlarged segments)
const HIERO_MID   = (HIERO_INNER + HIERO_OUTER) / 2;


// Pixel-art glyphs for menu icons in hieroglyph ring
const HIERO_GLYPHS = {
  gear: [
    '...........................',
    '..........#######..........',
    '.......#..#######..#.......',
    '......##..#######..##......',
    '....#####..#####..#####....',
    '....#####..#####..#####....',
    '...#######.#####.#######...',
    '..#######################..',
    '....###################....',
    '......###############......',
    '.###...#####...#####...###.',
    '.##########.....##########.',
    '.#########.......#########.',
    '.#########.......#########.',
    '.#########.......#########.',
    '.##########.....##########.',
    '.###...#####...#####...###.',
    '......###############......',
    '....###################....',
    '..#######################..',
    '...#######.#####.#######...',
    '....#####..#####..#####....',
    '....#####..#####..#####....',
    '......##..#######..##......',
    '.......#..#######..#.......',
    '..........#######..........',
    '...........................',
  ],
  exit: [
    '..............#############',
    '..............#...........#',
    '..............#...........#',
    '..............#..#######..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '.....##.......#..#.....#..#',
    '....###.......#..#.....#..#',
    '...###........#..#######..#',
    '..###.........#...........#',
    '.############.#.........###',
    '#############.#.........###',
    '.############.#.........###',
    '..###.........#...........#',
    '...###........#..#######..#',
    '....###.......#..#.....#..#',
    '.....##.......#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#######..#',
    '..............#...........#',
    '..............#...........#',
    '..............#############',
  ],
  book: [
    '...........................',
    '...######################.',
    '..#######################.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.###.....#.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.###.....#.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.###.###.#.',
    '..##.....................#.',
    '..##.###.###.###.........#.',
    '..##.....................#.',
    '..#######################.',
    '...######################.',
    '...........................',
  ],
};

// Menu segment definitions (indices relative to wheel segment count)
// Placed ~85% around the ring = upper-left quadrant
const HIERO_MENU_DEFS = [
  { offsetFromEnd: 12, id: 'catalogue', glyph: 'book' },
  { offsetFromEnd: 4,  id: 'settings',  glyph: 'gear' },
  { offsetFromEnd: 5,  id: 'exit',      glyph: 'exit' },
];

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
    this._updateGaugeUnlocks();

    this._time = 0;
    this._pops = [];
    this._shake = { x: 0, y: 0, intensity: 0, decay: 0, time: 0 };
    this._flash = 0;
    this._goldDisplay = 0; // animated gold counter // invert flash timer (>0 = active)
    this._inShop = false;
    this._shopResolve = null;

    // Build default wheel data BEFORE background (background needs segment info)
    const defaultWheel = BALANCE.INITIAL_WHEEL.map((id, i) => ({
      id: 'seg_' + i, symbolId: id, weight: 1, modifiers: [],
    }));
    this.wheel.setWheel(defaultWheel);

    this._initBackground(defaultWheel);

    // Mouse tracking (normalized -1..1 from center)
    this._mx = 0;
    this._my = 0;
    this._hubHover = false;
    this._sweepTrigger = -99;  // time of last hover-triggered sweep

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

    // UI overlay (popups/menus — drawn AFTER postfx, NOT affected by shader)
    this._uiCanvas = document.createElement('canvas');
    this._uiCanvas.width = CW;
    this._uiCanvas.height = CH;
    this._uiCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;';
    document.body.appendChild(this._uiCanvas);
    this._uiCtx = this._uiCanvas.getContext('2d');

    // Audio
    this._audioCtx = null;
    this.wheel.onPegHit = () => this._tick();
    this.wheel.onBallEject = () => this._playEject();
    this.wheel.onFlipMid = () => this._shakeStart(3, 0.2);
    this.wheel.onFlipDone = () => this._shakeStart(8, 0.3);

    // Input (on display canvas)
    this._display.addEventListener('click', e => this._handleClick(e));
    this._display.addEventListener('mousemove', e => this._handleMouse(e));
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._catalogueOpen) { this._closeCatalogue(); e.preventDefault(); }
    });
    this._display.addEventListener('wheel', e => {
      if (!this._catalogueOpen) return;
      const TAB_DATA_LENS = [SYMBOLS.length, RELICS.length, CHOICES.length];
      const maxScroll = Math.max(0, TAB_DATA_LENS[this._catalogueTab] - 18);
      this._catalogueScroll = Math.max(0, Math.min(maxScroll, this._catalogueScroll + (e.deltaY > 0 ? 1 : -1)));
      e.preventDefault();
    }, { passive: false });

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

    const x = Math.floor((e.clientX - rect.left) / rect.width * W);
    const y = Math.floor((e.clientY - rect.top) / rect.height * H);


    if (this._inShop && this.wheel.flipped) {
      const hit = this.wheel.shopHitTest(x, y, WHEEL_CX, WHEEL_CY);
      this.wheel.shopSetHover(hit);
      this._display.style.cursor = hit ? 'pointer' : 'default';
      return;
    }

    // Menu button hover detection (hieroglyph ring)
    const menuHit = this._hieroHitTest(x, y);
    this._menuHover = menuHit;

    // Hub hover detection
    const dx = x - WHEEL_CX;
    const dy = (y - WHEEL_CY) / (this.wheel.tilt || 0.65);
    const wasHover = this._hubHover;
    this._hubHover = dx * dx + dy * dy < 40 * 40;
    this._display.style.cursor = (menuHit || (this._hubHover && !this._spinning)) ? 'pointer' : 'default';

    // Trigger sweep on hover enter
    if (this._hubHover && !wasHover) this._sweepTrigger = this._time;
  }

  _handleClick(e) {
    this._initAudio();
    const { x, y } = this._mapCoords(e);

    // Catalogue overlay intercepts all clicks when open
    if (this._catalogueOpen) {
      this._catalogueClick(x, y);
      return;
    }

    // ── Shop click handling ──
    if (this._inShop && this.wheel.flipped) {
      const hit = this.wheel.shopHitTest(x, y, WHEEL_CX, WHEEL_CY);
      if (hit) {
        this._handleShopClick(hit);
        return;
      }
    }

    // Menu button click (hieroglyph ring)
    const menuHit = this._hieroHitTest(x, y);
    if (menuHit) {
      this._onMenuClick(menuHit);
      return;
    }

    // Hub button click (ellipse hit test with tilt)
    const dx = x - WHEEL_CX;
    const dy = (y - WHEEL_CY) / (this.wheel.tilt || 0.65);
    if (dx * dx + dy * dy < 40 * 40) {
      if (this._spinning) return;
      this._onAction();
      return;
    }
  }

  _onMenuClick(menuId) {
    this._playSelect();
    if (menuId === 'catalogue') {
      this._openCatalogue();
    } else if (menuId === 'settings') {
      this._pop('SETTINGS');
    } else if (menuId === 'exit') {
      this._pop('EXIT');
    }
  }

  // ── Catalogue overlay ──
  _openCatalogue() {
    this._catalogueOpen = true;
    this._catalogueTab = 0;        // 0=symbols, 1=relics, 2=upgrades
    this._catalogueScroll = 0;
  }

  _closeCatalogue() {
    this._catalogueOpen = false;
  }

  _drawCatalogue(ctx) {
    if (!this._catalogueOpen) return;
    const TAB_NAMES = ['BILLES', 'RELIQUES', 'UPGRADES'];
    const TAB_DATA = [
      SYMBOLS.map(s => ({ name: s.name, sprite: s.id, rarity: s.rarity, desc: `${s.color} — val ${s.baseValue}${s.specialEffect ? ' — ' + s.specialEffect : ''}` })),
      RELICS.map(r => ({ name: r.name, sprite: 'relic_' + r.rarity, rarity: r.rarity, desc: r.description })),
      CHOICES.map(c => ({ name: c.name, sprite: c.payload?.symbolId || 'ball', rarity: null, desc: c.description })),
    ];

    // Dims
    const PW = 320, PH = 200;
    const PX0 = Math.floor((W - PW) / 2), PY0 = Math.floor((H - PH) / 2);
    const TAB_H = 14, HEAD_H = 12, ROW_H = 10;
    const BODY_Y = PY0 + TAB_H + HEAD_H;
    const BODY_H = PH - TAB_H - HEAD_H - 6;
    const MAX_ROWS = Math.floor(BODY_H / ROW_H);

    // Backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(PX0 - 2, PY0 - 2, PW + 4, PH + 4);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(PX0, PY0, PW, PH);

    // Border
    ctx.strokeStyle = PAL.darkGold;
    ctx.lineWidth = 1;
    ctx.strokeRect(PX0 + 0.5, PY0 + 0.5, PW - 1, PH - 1);

    // Tabs
    const tabW = Math.floor(PW / TAB_NAMES.length);
    for (let t = 0; t < TAB_NAMES.length; t++) {
      const tx = PX0 + t * tabW;
      if (t === this._catalogueTab) {
        ctx.fillStyle = PAL.darkRed;
        ctx.fillRect(tx, PY0, tabW, TAB_H);
      }
      ctx.strokeStyle = PAL.darkGold;
      ctx.strokeRect(tx + 0.5, PY0 + 0.5, tabW - 1, TAB_H - 1);
      drawTextCentered(ctx, TAB_NAMES[t], tx + Math.floor(tabW / 2), PY0 + 3, t === this._catalogueTab ? PAL.gold : PAL.midGray);
    }

    // Column header
    const hdrY = PY0 + TAB_H + 1;
    drawText(ctx, 'NOM', PX0 + 4, hdrY, PAL.gold);
    drawText(ctx, 'DESCRIPTION', PX0 + 100, hdrY, PAL.gold);

    // Rows
    const items = TAB_DATA[this._catalogueTab];
    const scroll = this._catalogueScroll;
    const visible = items.slice(scroll, scroll + MAX_ROWS);
    const RARITY_COL = { common: PAL.white, uncommon: PAL.green, rare: PAL.blue, legendary: PAL.gold };
    for (let i = 0; i < visible.length; i++) {
      const it = visible[i];
      const ry = BODY_Y + i * ROW_H;
      const col = it.rarity ? (RARITY_COL[it.rarity] || PAL.white) : PAL.white;
      drawSpriteCentered(ctx, it.sprite, PX0 + 4 + Math.floor(SPRITE_SIZE / 2), ry + Math.floor(ROW_H / 2), 1);
      drawText(ctx, it.name, PX0 + 4 + SPRITE_SIZE + 2, ry, col);
      drawText(ctx, it.desc, PX0 + 100, ry, PAL.midGray);
    }

    // Scrollbar hint
    if (items.length > MAX_ROWS) {
      const pct = scroll / Math.max(1, items.length - MAX_ROWS);
      const sbH = Math.max(8, Math.floor(BODY_H * MAX_ROWS / items.length));
      const sbY = BODY_Y + Math.floor((BODY_H - sbH) * pct);
      ctx.fillStyle = PAL.darkGold;
      ctx.fillRect(PX0 + PW - 5, sbY, 3, sbH);
    }

    // Close hint
    drawTextCentered(ctx, '[ESC] FERMER', PX0 + Math.floor(PW / 2), PY0 + PH - 9, PAL.darkGold);
  }

  _catalogueClick(x, y) {
    const PW = 320, PH = 200;
    const PX0 = Math.floor((W - PW) / 2), PY0 = Math.floor((H - PH) / 2);
    const TAB_H = 14;

    // Outside panel → close
    if (x < PX0 || x > PX0 + PW || y < PY0 || y > PY0 + PH) {
      this._closeCatalogue();
      return;
    }

    // Tab row click
    if (y >= PY0 && y < PY0 + TAB_H) {
      const tabW = Math.floor(PW / 3);
      const t = Math.floor((x - PX0) / tabW);
      if (t >= 0 && t < 3) {
        this._catalogueTab = t;
        this._catalogueScroll = 0;
      }
    }
  }

  _handleShopClick(hit) {
    const state = this.game.getState();
    const run = state.run;
    const meta = state.meta;
    if (!run) return;

    if (hit.type === 'offering') {
      const offering = run.shopOfferings[hit.index];
      if (!offering) return;
      if (meta.tickets < offering.finalCost) {
        this._pop('NO TICKETS!');
        return;
      }
      this.wheel.shopRemoveOffering(hit.index);
      const ok = this.game.shopBuyRelic(hit.index);
      if (ok) {
        this._pop('BOUGHT!');
        this._shakeStart(3, 0.2);
        // Refresh shop display
        const rerollCost = BALANCE.SHOP_REROLL_BASE + (run.rerollCount || 0) * BALANCE.SHOP_REROLL_INCREMENT;
        this.wheel.setShop(run.shopOfferings, meta.tickets, rerollCost);
        // Update orbit slots with relics
        this._syncRelicSlots();
      }
    } else if (hit.type === 'reroll') {
      const rerollCost = BALANCE.SHOP_REROLL_BASE + (run.rerollCount || 0) * BALANCE.SHOP_REROLL_INCREMENT;
      if (meta.tickets < rerollCost) {
        this._pop('NO TICKETS!');
        return;
      }
      const ok = this.game.shopReroll();
      if (ok) {
        this._pop('REROLL!');
        this._shakeStart(2, 0.15);
        const newRerollCost = BALANCE.SHOP_REROLL_BASE + (run.rerollCount || 0) * BALANCE.SHOP_REROLL_INCREMENT;
        this.wheel.setShop(run.shopOfferings, meta.tickets, newRerollCost);
      }
    } else if (hit.type === 'leave') {
      this.game.endShop();
      this._closeForgeShop();
    }
  }

  _syncRelicSlots() {
    const run = this.game.getState().run;
    if (!run) return;
    const slots = [];
    for (let i = 0; i < 8; i++) {
      if (run.relics[i]) {
        const r = run.relics[i];
        const raritySprite = {
          common: 'relic_common', uncommon: 'relic_uncommon',
          rare: 'relic_rare', legendary: 'relic_legendary',
        };
        slots.push({ id: raritySprite[r.rarity] || 'ticket' });
      } else {
        slots.push(null);
      }
    }
    this.wheel.setSlots(slots);
  }

  // ── Game flow ──
  _syncWheel() {
    const state = this.game.getState();
    if (state.run) {
      this.wheel.setWheel(state.run.wheel);
      this.wheel.placeBalls(state.run.ballsLeft);
      this.wheel.setCorruption(state.run.corruption);
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
        if (this._inShop) break; // let forge shop handle it
        this.game.endShop();
      } else if (phase === 'GAME_OVER' || phase === 'VICTORY') {
        // Restart run
        this.game.startRun();
      } else break;
    }
    this._syncWheel();
  }

  _updateGaugeUnlocks() {
    const meta = this.game.getState().meta;
    this.wheel.setGaugeUnlocks([
      true,
      meta.unlocks.includes('unlock_gauge_2'),
      meta.unlocks.includes('unlock_gauge_3'),
      true, // gauge 3 = corruption gauge, always visible
    ]);
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
      const pos = this.wheel.getPocketPosition(results[i], WHEEL_CX, WHEEL_CY);
      this._pop('+' + result.value, pos.x, pos.y - 15);

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
    this.wheel.setBonusMode(false);

    // Advance game state through RESULTS → CHOICE → SHOP
    this._advanceToShop();

    const phase = this.game.getPhase();
    if (phase === 'GAME_OVER' || phase === 'VICTORY') {
      // Failed or won — skip shop, restart
      await this._delay(1000);
      this._autoAdvance();
      return;
    }

    // Flip wheel to show forge shop
    await this._delay(500);
    this._openForgeShop();
    this.wheel.startFlip();
    await this._delay(600);

    // Wait for shop interaction (resolved by _closeForgeShop)
    await new Promise(resolve => { this._shopResolve = resolve; });

    // Flip back
    this.wheel.startFlip();
    await this._delay(600);

    // Auto-advance remaining phases (SHOP→IDLE for next round)
    this._autoAdvance();
  }

  _advanceToShop() {
    let safety = 10;
    while (safety-- > 0) {
      const phase = this.game.getPhase();
      if (phase === 'SHOP') break;
      if (phase === 'GAME_OVER' || phase === 'VICTORY') break;
      if (phase === 'RESULTS') {
        this.game.continueFromResults();
      } else if (phase === 'CHOICE') {
        this.game.skipChoice();
      } else break;
    }
  }

  _openForgeShop() {
    const state = this.game.getState();
    const run = state.run;
    if (!run) return;
    const rerollCost = BALANCE.SHOP_REROLL_BASE + (run.rerollCount || 0) * BALANCE.SHOP_REROLL_INCREMENT;
    this.wheel.placeBalls(run.ballsLeft);
    this.wheel.setShop(run.shopOfferings, state.meta.tickets, rerollCost);
    this._inShop = true;
  }

  _closeForgeShop() {
    this._inShop = false;
    if (this._shopResolve) {
      const resolve = this._shopResolve;
      this._shopResolve = null;
      resolve();
    }
  }

  _pop(text, x, y) {
    this._pops.push({
      text,
      x: x != null ? x : WHEEL_CX + (Math.random() - 0.5) * 60,
      y: y != null ? y : WHEEL_CY - 50 - Math.random() * 20,
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

  // ═══ Pre-rendered background ("Forge Aura") ═══
  _initBackground(wheelData) {
    const BW = W + BG_PAD * 2, BH = H + BG_PAD * 2;
    const c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const bgCtx = c.getContext('2d');
    bgCtx.imageSmoothingEnabled = false;

    const imgData = bgCtx.createImageData(BW, BH);
    const buf = new Uint32Array(imgData.data.buffer);

    const CX = WHEEL_CX + BG_PAD, CY = WHEEL_CY + BG_PAD;
    // Zone radii for layered darkness
    const ORBIT_OUTER = 115;       // matches RING_R in _drawUIRing — transparent inside
    const AURA_TRANS = 8;          // transition from orbit edge to full aura

    // ── Precompute hiero ring segment arcs (matching wheel wedges) ──
    const numSegs = 16;
    const TWO_PI = Math.PI * 2;
    const initAngle = -Math.PI / 2 - Math.PI / numSegs;
    const hieroArcs = new Float64Array(numSegs + 1);
    for (let i = 0; i <= numSegs; i++) {
      hieroArcs[i] = i * TWO_PI / numSegs;
    }
    // Menu segment lookup { segIndex → { id } }
    const menuSegs = {};
    for (const def of HIERO_MENU_DEFS) {
      const idx = numSegs - def.offsetFromEnd;
      if (idx >= 0 && idx < numSegs) menuSegs[idx] = { id: def.id, glyph: def.glyph };
    }

    // Bayer 4×4 ordered dither matrix (values 0..15)
    const BAYER = [
      [ 0, 8, 2,10],
      [12, 4,14, 6],
      [ 3,11, 1, 9],
      [15, 7,13, 5],
    ];

    // Deterministic hash for glint scatter
    const hash = (x, y) => ((x * 374761393 + y * 668265263) >>> 0) & 255;

    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const dx = x - CX, dy = y - CY;
        const dist2 = dx * dx + dy * dy;
        const idx = y * BW + x;

        // Inside UI ring — fully transparent (inner disc drawn separately with own parallax)
        if (dist2 < ORBIT_OUTER * ORBIT_OUTER) { buf[idx] = 0; continue; }

        const dist = Math.sqrt(dist2);
        const bayer = BAYER[y & 3][x & 3];

        // ── Zone attenuation (transition at orbit edge → full aura) ──
        let zoneAtt;
        if (dist < ORBIT_OUTER + AURA_TRANS) {
          zoneAtt = (dist - ORBIT_OUTER) / AURA_TRANS;
        } else {
          zoneAtt = 1;
        }

        // ── Edge vignette (darken near canvas borders) ──
        const ex = x - BG_PAD, ey = y - BG_PAD;
        const edgeDist = Math.min(ex, ey, W - 1 - ex, H - 1 - ey);
        const vignette = Math.min(1, edgeDist / 20);

        // ── Radial fade from orbit edge ──
        const radialFade = Math.max(0, 1 - Math.max(0, dist - ORBIT_OUTER) / 90);

        // ── 8 radial light rays (warm spokes) ──
        const angle = Math.atan2(dy, dx);
        const ray = Math.pow(Math.max(0, Math.cos(angle * 4)), 6);

        // ── 4 interstitial wedges (between the 4 golden rays, same cos^6 shape) ──
        const ray2 = Math.pow(Math.max(0, -Math.cos(angle * 4)), 6);

        // ── Concentric ring accents (outside orbit zone) ──
        const ringDist = (dist - ORBIT_OUTER) % 32;
        const ring = (dist > ORBIT_OUTER && ringDist < 1.0) ? 0.25 : 0;

        // ── Hieroglyph ring — detect segment for dithered rendering ──
        let hieroSeg = -1;
        if (dist >= HIERO_INNER && dist <= HIERO_OUTER) {
          let ha = angle - initAngle;
          ha = ((ha % TWO_PI) + TWO_PI) % TWO_PI;
          for (let i = 0; i < numSegs; i++) {
            if (ha < hieroArcs[i + 1]) { hieroSeg = i; break; }
          }
          if (hieroSeg < 0) hieroSeg = numSegs - 1;
        }

        // ── Combined brightness ──
        const inHiero = hieroSeg >= 0;
        const hieroAtt = inHiero ? 1 : zoneAtt; // no fade-out inside hiero ring
        const brightness = inHiero
          ? vignette * 0.65
          : hieroAtt * vignette *
            (0.08 + 0.28 * radialFade + 0.35 * ray * radialFade
             + 0.15 * ray2 * radialFade + ring * radialFade);
        const threshold = brightness * 16;

        if (bayer < threshold) {
          if (inHiero) {
            buf[idx] = menuSegs[hieroSeg] ? PAL32.midGray
              : (hieroSeg % 2 === 0) ? PAL32.darkRed : PAL32.darkGray;
          } else {
            buf[idx] = (radialFade > 0.35 && ray > 0.15)
              ? PAL32.darkGold
              : (radialFade > 0.35 && ray2 > 0.15)
                ? PAL32.midGray
                : PAL32.darkGray;
          }
        } else {
          buf[idx] = inHiero ? PAL32.black
            : (radialFade > 0.35 && ray2 > 0.15) ? PAL32.darkGray : PAL32.black;
        }
      }
    }

    // ── Glint scatter (sparse bright specks — dust/sparks in metal) ──
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const dx = x - CX, dy = y - CY;
        if (dx * dx + dy * dy < ORBIT_OUTER * ORBIT_OUTER) continue;
        if (hash(x, y) < 2) buf[y * BW + x] = PAL32.midGray;   // ~0.8%
      }
    }

    bgCtx.putImageData(imgData, 0, 0);

    // ── Stamp segment labels into ring (menu icons) ──
    bgCtx.imageSmoothingEnabled = false;
    for (let s = 0; s < numSegs; s++) {
      const midAngle = initAngle + (hieroArcs[s] + hieroArcs[s + 1]) / 2;
      const gcx = CX + Math.cos(midAngle) * HIERO_MID;
      const gcy = CY + Math.sin(midAngle) * HIERO_MID;

      bgCtx.save();
      bgCtx.translate(gcx, gcy);

      const menu = menuSegs[s];
      if (menu) {
        // Menu icon: pixel art glyph (drawn upright, no rotation)
        const glyphData = HIERO_GLYPHS[menu.glyph];
        if (glyphData) {
          const gw = glyphData[0].length, gh = glyphData.length;
          const pxSize = Math.max(1, Math.floor(27 / Math.max(gw, gh)));
          const ox = Math.floor(gw * pxSize / 2), oy = Math.floor(gh * pxSize / 2);
          bgCtx.fillStyle = PAL.white;
          for (let gy = 0; gy < gh; gy++) {
            for (let gx = 0; gx < gw; gx++) {
              if (glyphData[gy][gx] === '#')
                bgCtx.fillRect(gx * pxSize - ox, gy * pxSize - oy, pxSize, pxSize);
            }
          }
        }
      }

      bgCtx.restore();
    }

    // Store menu segment data for hit-testing
    this._menuSegments = [];
    for (let s = 0; s < numSegs; s++) {
      const menu = menuSegs[s];
      if (menu) {
        this._menuSegments.push({
          id: menu.id,
          glyph: menu.glyph,
          segIdx: s,
          startAngle: initAngle + hieroArcs[s],
          endAngle: initAngle + hieroArcs[s + 1],
        });
      }
    }
    this._menuHover = null;

    this._bgCanvas = c;
  }

  // ── Hieroglyph ring hit-test (returns menu id or null) ──
  _hieroHitTest(mx, my) {
    const dx = mx - WHEEL_CX, dy = my - WHEEL_CY;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < HIERO_INNER * HIERO_INNER || dist2 > HIERO_OUTER * HIERO_OUTER) return null;
    const a = Math.atan2(dy, dx);
    for (const seg of this._menuSegments) {
      const sa = seg.startAngle, ea = seg.endAngle;
      // Normalize a into [sa, sa+2π) for wrap-around
      let na = a;
      while (na < sa) na += Math.PI * 2;
      while (na >= sa + Math.PI * 2) na -= Math.PI * 2;
      if (na >= sa && na < ea) return seg.id;
    }
    return null;
  }

  _render() {
    const ctx = this._ctx;
    ctx.imageSmoothingEnabled = false;

    // Draw everything in logical 480×270 space, scaled 2×
    ctx.save();
    ctx.scale(PX, PX);
    ctx.translate(this._shake.x, this._shake.y);

    // Clear previous frame (prevents bleed-through in transparent bg regions)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // ── Parallax offsets ──
    const px = this._mx;   // -1..1
    const py = this._my;
    const pocketOx = px * 1.0;   // pockets: slowest wheel layer
    const pocketOy = py * 0.6;
    const labelOx  = px * 1.4;   // number ring: medium
    const labelOy  = py * 0.9;
    const wheelOx = px * 1.5;    // wheel base (balls, hub circle)
    const wheelOy = py * 1;
    const rimOx   = px * 2.0;    // rim border: fastest wheel layer
    const rimOy   = py * 1.3;
    const periOx = px * 2;       // gauge + slots: 2px max
    const periOy = py * 2;
    const hudOx = px * 4.5;      // HUD: 4.5px max (fastest)
    const hudOy = py * 3;
    const bgOx = px * 3;           // bg aura (aligned with UI ring)
    const bgOy = py * 2.5;
    const uiOx = px * 3;          // UI ring
    const uiOy = py * 2.5;

    // Background: inner disc (rim parallax) + outer aura (UI ring parallax)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(WHEEL_CX + rimOx, WHEEL_CY + rimOy, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(this._bgCanvas, -BG_PAD + bgOx, -BG_PAD + bgOy);

    // Menu segment hover highlight (drawn over background)
    if (this._menuHover) {
      const seg = this._menuSegments.find(s => s.id === this._menuHover);
      if (seg) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(WHEEL_CX + bgOx, WHEEL_CY + bgOy, HIERO_OUTER - 1, seg.startAngle, seg.endAngle);
        ctx.arc(WHEEL_CX + bgOx, WHEEL_CY + bgOy, HIERO_INNER + 1, seg.endAngle, seg.startAngle, true);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Wheel (parallax layer 1) + peripherals (layer 2)
    const _layers = {
      pocket: { x: pocketOx - wheelOx, y: pocketOy - wheelOy },
      label:  { x: labelOx - wheelOx,  y: labelOy - wheelOy },
      rim:    { x: rimOx - wheelOx,    y: rimOy - wheelOy },
    };
    this.wheel.draw(ctx, WHEEL_CX + wheelOx, WHEEL_CY + wheelOy, periOx - wheelOx, periOy - wheelOy, _layers);

    // UI Ring (parallax layer 2.5 — between slots and title)
    this._drawUIRing(ctx, WHEEL_CX + uiOx, WHEEL_CY + uiOy);

    // Title (parallax layer 3 — moves most)
    drawTextCenteredOutlined(ctx, 'SPINFORGE', W / 2 + hudOx, 6 + hudOy, PAL.gold, 5);

    // Commit hash (bottom right)
    drawText(ctx, typeof __COMMIT__ !== 'undefined' ? __COMMIT__ : '???', W - 40, H - 8, PAL.midGray, 1);

    this._drawPops(ctx);



    // Hub button (own parallax layer — faster than labels, slower than rim)
    const hubBtnOx = px * 1.7;
    const hubBtnOy = py * 1.1;
    if (!this.wheel.flipped) {
      this._drawHubBtn(ctx, hubBtnOx, hubBtnOy);
    }

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

    // ── UI overlay (popups — NOT affected by postfx shader) ──
    const uiCtx = this._uiCtx;
    uiCtx.clearRect(0, 0, CW, CH);
    uiCtx.save();
    uiCtx.scale(PX, PX);
    this._drawCatalogue(uiCtx);

    uiCtx.restore();

    // ── Lights overlay (smooth, NOT quantized) ──
    this._drawLights(wheelOx, wheelOy);
  }

  // ── Light map (screen-mode glow, after quantize for smooth gradients) ──
  _drawLights(wox, woy) {
    const ctx = this._lightsCtx;
    ctx.clearRect(0, 0, CW, CH);

    // Hub glow (always active, stepped pulse)
    if (!this._spinning && !this._inShop) {
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

  // ── UI Ring (gold + tickets + balls along right arc) ──
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

    // 3 indicators along arc on right side, inside ring
    const items = [
      { angle: -IND_ARC_STEP / 2, sprite: 'coin',   anim: true,  val: score, col: PAL.gold },
      { angle:  IND_ARC_STEP / 2, sprite: 'ticket', anim: false, val: this.game.getState().meta.tickets, col: PAL.green },
    ];

    for (const it of items) {
      const ix = Math.round(cx + IND_ARC_R * Math.cos(it.angle));
      const iy = Math.round(cy + IND_ARC_R * Math.sin(it.angle));

      const txt = String(it.val);
      const tw = measureText(txt);
      const gap = 2;
      const totalW = tw + gap + SPRITE_SIZE;
      const sx = ix - Math.floor(totalW / 2);

      // Number first (left)
      drawText(ctx, txt, sx, iy - Math.floor(CHAR_H / 2), it.col, 1);

      // Sprite second (right of number)
      const sprCX = sx + tw + gap + Math.floor(SPRITE_SIZE / 2);
      if (it.anim) {
        drawAnimSpriteCentered(ctx, it.sprite, sprCX, iy, 1, this._time, 6);
      } else {
        drawSpriteCentered(ctx, it.sprite, sprCX, iy, 1);
      }
    }
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
