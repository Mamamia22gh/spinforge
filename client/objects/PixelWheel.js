import { PAL, PAL32, SEG_A, SEG_B, DIVIDER_COLOR, HUB_BG, HUB_BORDER, RIM_COLOR } from '../gfx/PaletteDB.js';
import { drawText, drawTextCentered, measureText, CHAR_H } from '../gfx/BitmapFont.js';
import { drawSpriteCentered, drawAnimSpriteCentered, SPRITE_SIZE } from '../gfx/PixelSprites.js';

// ── Layout (proportional to wheel radius R) ──
const HUB_P = 0.28;
const HUB_COLLIDE_P = 0.32;  // collision radius (larger than visual)
const POCKET_INNER_P = 0.30;
const POCKET_OUTER_P = 0.37;
const LABEL_P = 0.425;
const LABEL_INNER_P = 0.38;
const LABEL_OUTER_P = 0.48;
const RIM_P = 0.55;

// ── Physics (absolute px, set from R) ──
let HUB_R, POCKET_INNER, POCKET_OUTER, LABEL_INNER, LABEL_OUTER, RIM_R;

const BALL_RADIUS_P = 0.008;
let BALL_RADIUS;

const BOWL_GRAVITY = 120;
const RESTITUTION = 0.5;
const AIR_DAMPING = 0.997;
const SURFACE_FRICTION = 220;
const SETTLE_SPEED = 15;
const SETTLE_ANG_VEL = 0.3;
const SETTLE_TIME = 0.15;
const DIVIDER_W = 1.5;
const PHYSICS_DT = 1 / 120;
const SPIN_MIN = 10;
const SPIN_MAX = 14;
const SPIN_DECEL = 0.996;
const GRAVITY_BOOST_THRESHOLD = 2.5;
const GRAVITY_BOOST_MAX = 6;

// ── 3D perspective tilt ──
// (now dynamic — see constructor)

// ── Drop animation ──
const DROP_STAGGER = 0.05;   // seconds between each ball
const DROP_DURATION = 0.50;  // seconds per ball drop (total)
const DROP_HEIGHT = 130;     // pixels above final position
const GAUGE_TRAVEL = 0.15;   // seconds for phase 1 (slide to gauge exit)

// ── Gauge (ball magazine) ──
const GAUGE_SPAN = 0.60;     // total arc per gauge (~34°)
const GAUGE_CONFIGS = [
  { center: 0,              start: -0.30,               end: 0.30 },               // right (default)
  { center: -Math.PI / 2,   start: -Math.PI / 2 - 0.30, end: -Math.PI / 2 + 0.30 }, // top
  { center:  Math.PI / 2,   start:  Math.PI / 2 - 0.30, end:  Math.PI / 2 + 0.30 }, // bottom
  { center:  Math.PI,       start:  Math.PI - 0.30,     end:  Math.PI + 0.30 },     // left
];
const MAX_BALLS_PER_GAUGE = 14;
const GAUGE_BALL_SPACING = 0.04; // radians between ball centers

function _bounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}  // vertical compression (1 = flat, 0.4 = ~66°)

export class PixelWheel {
  constructor() {
    // Fixed physics radius — independent of canvas
    this.R = 150;
    this._updateRadii();

    this._data = [];
    this._angle = -Math.PI / 2 - Math.PI / 40;
    this._angVel = 0;
    this._balls = [];
    this._placedBalls = [];
    this._results = [];
    this._onDone = null;
    this._acc = 0;
    this._time = 0;
    this._highlights = [];
    this.onPegHit = null;
    this.onBallEject = null;
    this._lastPeg = 0;
    this._slots = [];  // external slot data (8 entries, null = empty)
    this._dropClock = 0;
    this._dropping = false;
    this._inGauge = false;
    this._ejectQueue = [];
    this._ejecting = false;
    this._ejectClock = 0;
    this._frameLights = [];
    this._bonusMode = false;
    this._gaugeUnlocks = [true, false, false, false]; // gauge 0 always unlocked
    this._corruption = 0.5; // corruption fill 0..1
    this._counterGold = 0;
    this._counterTickets = 0;

    this._tilt = 1.0;
    this._flip = null;
    this.onFlipMid = null;
    this.onFlipDone = null;

    // Hub screen state
    this._hub = {
      lastSymbolId: '', lastValue: 0, valueFade: 0,
      streak: 0, multi: 1, fever: false,
      history: [],
      message: '', messageFade: 0,
      score: 0, scoreTarget: 0,
    };

    // Forge shop state
    this._shop = {
      offerings: [],
      currency: 0,
      rerollCost: 0,
      hoverIdx: -1,
      buyFlash: -1,
      buyFlashTimer: 0,
    };
  }

  _updateRadii() {
    const R = this.R;
    HUB_R = R * HUB_P;
    POCKET_INNER = R * POCKET_INNER_P;
    POCKET_OUTER = R * POCKET_OUTER_P;
    LABEL_INNER = R * LABEL_INNER_P;
    LABEL_OUTER = R * LABEL_OUTER_P;
    RIM_R = R * RIM_P;
    BALL_RADIUS = Math.max(1.5, R * BALL_RADIUS_P);
    this._forgeBgCanvas = null; // invalidate cached forge bg
  }

  _initForgeBackground() {
    const r = Math.ceil(RIM_R);
    const size = r * 2 + 2;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const fCtx = c.getContext('2d');

    const imgData = fCtx.createImageData(size, size);
    const buf = new Uint32Array(imgData.data.buffer);
    const fcx = r + 1, fcy = r + 1;

    const BAYER = [
      [ 0, 8, 2,10],
      [12, 4,14, 6],
      [ 3,11, 1, 9],
      [15, 7,13, 5],
    ];
    const hash = (x, y) => ((x * 374761393 + y * 668265263) >>> 0) & 255;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - fcx, dy = y - fcy;
        const dist2 = dx * dx + dy * dy;
        const idx = y * size + x;
        if (dist2 > r * r) { buf[idx] = 0; continue; }

        const dist = Math.sqrt(dist2);
        const bayer = BAYER[y & 3][x & 3];

        // Radial gradient: brighter near rim, darker at center
        const radialT = dist / r;
        const radialFade = radialT * radialT;

        // 8 radial light rays (warm forge spokes)
        const angle = Math.atan2(dy, dx);
        const ray = Math.pow(Math.max(0, Math.cos(angle * 4)), 6);

        // Concentric ring accents (tighter than exterior aura)
        const ringMod = dist % 12;
        const ring = (dist > 10 && ringMod < 0.8) ? 0.3 : 0;

        // Hub exclusion zone (very dark near center)
        const hubFade = Math.min(1, Math.max(0, (dist - HUB_R * 0.7) / (HUB_R * 0.5)));

        // Combined brightness
        const brightness = hubFade *
          (0.04 + 0.22 * radialFade + 0.30 * ray * radialFade + ring * radialFade);
        const threshold = brightness * 16;

        if (bayer < threshold) {
          buf[idx] = (ray > 0.15 && radialFade > 0.3)
            ? PAL32.midGray
            : PAL32.darkGray;
        } else {
          buf[idx] = PAL32.black;
        }
      }
    }

    // Glint scatter (sparse bright specks — forge sparks)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - fcx, dy = y - fcy;
        if (dx * dx + dy * dy > r * r) continue;
        if (hash(x, y) < 3) buf[y * size + x] = PAL32.midGray;
      }
    }

    fCtx.putImageData(imgData, 0, 0);
    this._forgeBgCanvas = c;
    this._forgeBgOff = fcx;
  }

  setWheel(data) {
    this._data = data;
    this._balls = [];
    this._placedBalls = [];
    this._results = [];
    this._highlights = [];
  }

  setGaugeUnlocks(unlocks) {
    this._gaugeUnlocks = unlocks;
  }

  setCorruption(v) { this._corruption = Math.max(0, Math.min(1, v)); }
  get corruption() { return this._corruption; }

  placeBalls(n) {
    this._placedBalls = [];
    this._balls = [];
    this._results = [];
    this._dropClock = 0;
    this._dropping = false;
    this._inGauge = true;

    const GAUGE_MID = (RIM_R + 16 + RIM_R + 21) / 2;

    // Collect unlocked gauges (exclude gauge 1=top, 2=bottom, 3=corruption)
    const activeGauges = [];
    for (let g = 0; g < GAUGE_CONFIGS.length; g++) {
      if (g === 1 || g === 2 || g === 3) continue;
      if (this._gaugeUnlocks[g]) activeGauges.push(g);
    }

    // Distribute balls round-robin, capped at MAX_BALLS_PER_GAUGE
    const perGauge = activeGauges.map(() => []);
    for (let i = 0; i < n; i++) {
      const slot = i % activeGauges.length;
      if (perGauge[slot].length < MAX_BALLS_PER_GAUGE) {
        perGauge[slot].push(i);
      }
    }

    let globalIdx = 0;
    for (let gi = 0; gi < activeGauges.length; gi++) {
      const gIdx = activeGauges[gi];
      const cfg = GAUGE_CONFIGS[gIdx];
      const indices = perGauge[gi];
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        // Target position on wheel
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const r = LABEL_OUTER + 2 + Math.random() * (RIM_R - LABEL_OUTER - BALL_RADIUS * 2 - 3);
        // Gauge: stack from end toward start, tightly packed
        const ga = cfg.end - j * GAUGE_BALL_SPACING;
        this._placedBalls.push({
          localX: Math.cos(a) * r,
          localY: Math.sin(a) * r,
          gaugeX: Math.cos(ga) * GAUGE_MID,
          gaugeY: Math.sin(ga) * GAUGE_MID,
          gaugeAngle: ga,
          gaugeIdx: gIdx,
          dropDelay: (indices.length - 1 - j) * DROP_STAGGER, // top of stack ejects first
          dropDur: DROP_DURATION,
        });
        globalIdx++;
      }
    }
  }

  ejectBalls() {
    this._inGauge = false;
    this._dropping = true;
    this._dropClock = 0;
  }

  spin() {
    return this.spinAndEject();
  }

  /**
   * Full physics flow: spin wheel + eject balls from gauge one by one.
   * Returns promise resolving with segment indices when all balls settle.
   */
  spinAndEject() {
    return new Promise(resolve => {
      this._angVel = SPIN_MIN + Math.random() * (SPIN_MAX - SPIN_MIN);
      this._results = [];
      this._onDone = resolve;
      this._balls = [];
      this._inGauge = false;
      this._dropping = false;

      // Build sorted eject queue (top ball first = lowest delay)
      this._ejectQueue = this._placedBalls.slice().sort((a, b) => a.dropDelay - b.dropDelay);
      this._placedBalls = [];
      this._ejecting = true;
      this._ejectClock = 0;

      this._spinTimeout = setTimeout(() => {
        if (!this._onDone) return;
        for (const b of this._balls) {
          if (!b.settled) this._settle(b);
        }
      }, 8000);
    });
  }

  highlight(idx) { this._highlights.push({ idx, t: 0 }); }

  getPocketPosition(idx, cx, cy) {
    const data = this._data;
    if (!data.length || idx < 0 || idx >= data.length) return { x: cx, y: cy };
    const tw = data.reduce((s, w) => s + w.weight, 0);
    let off = 0;
    for (let i = 0; i < idx; i++) off += (data[i].weight / tw) * Math.PI * 2;
    const angle = (data[idx].weight / tw) * Math.PI * 2;
    const mid = off + angle / 2;
    const worldA = this._angle + mid;
    const hlR = (POCKET_INNER + POCKET_OUTER) / 2;
    const TILT_Y = Math.abs(this._tilt);
    return {
      x: cx + Math.cos(worldA) * hlR,
      y: cy + Math.sin(worldA) * hlR * TILT_Y,
    };
  }
  get spinning() { return this._angVel > 0.05 || this._balls.some(b => !b.settled); }
  get speed() { return Math.abs(this._angVel); }
  get gaugeBallCount() {
    if (this._inGauge) return this._placedBalls.length;
    if (this._ejecting) return this._ejectQueue.length;
    return 0;
  }
  get hubRadius() { return HUB_R; }
  get tilt() { return Math.abs(this._tilt); }
  get lights() { return this._frameLights; }

  // ── Forge shop API ──
  setShop(offerings, currency, rerollCost) {
    this._shop.offerings = offerings || [];
    this._shop.currency = currency;
    this._shop.rerollCost = rerollCost;
    this._shop.hoverIdx = -1;
    this._shop.buyFlash = -1;
    this._shop.buyFlashTimer = 0;
  }

  shopUpdateCurrency(currency) {
    this._shop.currency = currency;
  }

  shopRemoveOffering(idx) {
    this._shop.buyFlash = idx;
    this._shop.buyFlashTimer = 0.4;
  }

  shopSetOfferings(offerings) {
    this._shop.offerings = offerings || [];
  }

  /**
   * Hit-test the forge shop face.
   */
  shopHitTest(x, y, cx, cy) {
    if (!this.flipped) return null;
    const TILT_Y = Math.abs(this._tilt);
    if (TILT_Y < 0.05) return null;

    const dx = x - cx;
    const dy = (y - cy) / TILT_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Hub area: single "CONTINUER" button
    if (dist < HUB_R) {
      return { type: 'leave' };
    }

    // 4-quadrant × 2-slot ring
    if (dist >= HUB_R + 3 && dist <= RIM_R - 3) {
      const QUAD_GAP = 0.10;
      const SLOT_GAP = 0.04;
      const QUAD_SPAN = Math.PI / 2 - QUAD_GAP;
      const SLOT_SPAN = (QUAD_SPAN - SLOT_GAP) / 2;
      const quadStarts = [
        -Math.PI / 2 + QUAD_GAP / 2,
         0            + QUAD_GAP / 2,
         Math.PI / 2  + QUAD_GAP / 2,
         Math.PI      + QUAD_GAP / 2,
      ];

      for (let q = 0; q < 4; q++) {
        for (let s = 0; s < 2; s++) {
          const a0 = quadStarts[q] + s * (SLOT_SPAN + SLOT_GAP);
          const a1 = a0 + SLOT_SPAN;
          // Normalize angle to match slot range
          let a = angle;
          // Handle wrap-around for the left quadrant (PI)
          if (q === 3 && a < 0) a += Math.PI * 2;
          const qa0 = q === 3 ? a0 + Math.PI * 2 * (a0 < 0 ? 1 : 0) : a0;
          // Simple: check if angle is between a0 and a1 (handling wrap)
          let inArc = false;
          if (a0 < -Math.PI) {
            inArc = (a >= a0 + Math.PI * 2 && a <= a1 + Math.PI * 2) || (a >= a0 && a <= a1);
          } else if (a1 > Math.PI) {
            inArc = (a >= a0) || (a <= a1 - Math.PI * 2);
          } else {
            inArc = (a >= a0 && a <= a1);
          }
          if (inArc) {
            const idx = q * 2 + s;
            // Slot 4 (bottom-left first slot) is the reroll button
            if (idx === 4) return { type: 'reroll' };
            return { type: 'offering', index: idx };
          }
        }
      }
    }

    return null;
  }

  shopSetHover(hoverResult) {
    if (!hoverResult) { this._shop.hoverIdx = -1; return; }
    if (hoverResult.type === 'offering') this._shop.hoverIdx = hoverResult.index;
    else if (hoverResult.type === 'reroll') this._shop.hoverIdx = 'reroll';
    else if (hoverResult.type === 'leave') this._shop.hoverIdx = 'leave';
    else this._shop.hoverIdx = -1;
  }

  get flipped() { return this._tilt < 0; }

  startFlip(duration = 0.45) {
    const to = this._tilt > 0 ? -1 : 1;
    this._flip = { from: this._tilt, to, duration, elapsed: 0, midFired: false };
  }

  // ── Hub screen API ──
  hubShowValue(symbolId, value) {
    this._hub.lastSymbolId = symbolId;
    this._hub.lastValue = value;
    this._hub.valueFade = 1.5;
    this._hub.history.push(symbolId);
    if (this._hub.history.length > 5) this._hub.history.shift();
  }
  hubSetStreak(n) { this._hub.streak = n; }
  hubSetMulti(m) { this._hub.multi = m; }
  hubSetFever(f) { this._hub.fever = f; }
  hubSetScore(s) { this._hub.scoreTarget = s; }
  hubMessage(msg) { this._hub.message = msg; this._hub.messageFade = 2.5; }
  setSlots(data) { this._slots = data || []; }
  setBonusMode(b) { this._bonusMode = b; }

  update(dt) {
    this._time += dt;
    for (let i = this._highlights.length - 1; i >= 0; i--) {
      this._highlights[i].t += dt;
      if (this._highlights[i].t > 1.5) this._highlights.splice(i, 1);
    }
    if (this._hub.score < this._hub.scoreTarget) {
      const diff = this._hub.scoreTarget - this._hub.score;
      this._hub.score += Math.max(1, Math.ceil(diff * 0.12));
      if (this._hub.score > this._hub.scoreTarget) this._hub.score = this._hub.scoreTarget;
    }
    this._hub.valueFade = Math.max(0, this._hub.valueFade - dt);
    this._hub.messageFade = Math.max(0, this._hub.messageFade - dt);

    // Flip animation
    if (this._flip) {
      this._flip.elapsed += dt;
      const t = Math.min(1, this._flip.elapsed / this._flip.duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this._tilt = this._flip.from + (this._flip.to - this._flip.from) * ease;

      if (!this._flip.midFired && Math.sign(this._tilt) !== Math.sign(this._flip.from)) {
        this._flip.midFired = true;
        if (this.onFlipMid) this.onFlipMid();
      }

      if (t >= 1) {
        this._tilt = this._flip.to;
        const cb = this.onFlipDone;
        this._flip = null;
        if (cb) cb();
      }
    }

    // Drop animation clock
    if (this._dropping) {
      this._dropClock += dt;
      const last = this._placedBalls[this._placedBalls.length - 1];
      if (last && this._dropClock >= last.dropDelay + last.dropDur) {
        this._dropping = false;
      }
    }

    // Staggered ball ejection (full physics)
    if (this._ejecting) {
      this._ejectClock += dt;
      while (this._ejectQueue.length > 0 && this._ejectClock >= this._ejectQueue[0].dropDelay) {
        const pb = this._ejectQueue.shift();

        // Spawn physics ball just inside rim — spread entry angle across gauge
        const cfg = GAUGE_CONFIGS[pb.gaugeIdx] || GAUGE_CONFIGS[0];
        const spread = cfg.end - cfg.start;
        const entryAngle = cfg.start + Math.random() * spread;
        const entryR = RIM_R - 4;
        const x = Math.cos(entryAngle) * entryR;
        const y = Math.sin(entryAngle) * entryR;

        // Velocity: inward + random tangential kick
        const inSpeed = 25 + Math.random() * 40;
        const tanSpeed = this._angVel * entryR * (0.1 + Math.random() * 0.5);
        const kickAngle = (Math.random() - 0.5) * 1.2; // random lateral kick
        const inDir = Math.atan2(-y, -x) + kickAngle;
        const tanDir = inDir + Math.PI / 2;

        this._balls.push({
          x, y,
          vx: Math.cos(inDir) * inSpeed + Math.cos(tanDir) * tanSpeed,
          vy: Math.sin(inDir) * inSpeed + Math.sin(tanDir) * tanSpeed,
          settled: false, timer: 0,
        });
        if (this.onBallEject) this.onBallEject();
      }
      if (this._ejectQueue.length === 0) this._ejecting = false;
    }

    this._acc += dt;
    while (this._acc >= PHYSICS_DT) { this._step(PHYSICS_DT); this._acc -= PHYSICS_DT; }
  }

  // ═══════════════════════════════════════════
  //  PHYSICS — completely unchanged
  // ═══════════════════════════════════════════

  _step(dt) {
    if (Math.abs(this._angVel) > 0.01) {
      const decel = Math.abs(this._angVel) < 3 ? 0.985 : SPIN_DECEL;
      this._angVel *= Math.pow(decel, dt * 120);
      this._angle += this._angVel * dt;
    } else this._angVel = 0;

    for (const b of this._balls) {
      if (b.settled) continue;
      const d = Math.sqrt(b.x * b.x + b.y * b.y);
      const gravMul = Math.abs(this._angVel) < GRAVITY_BOOST_THRESHOLD
        ? 1 + (GRAVITY_BOOST_MAX - 1) * (1 - Math.abs(this._angVel) / GRAVITY_BOOST_THRESHOLD)
        : 1;
      if (d > 1) {
        b.vx -= (b.x / d) * BOWL_GRAVITY * gravMul * dt;
        b.vy -= (b.y / d) * BOWL_GRAVITY * gravMul * dt;
      }
      const damp = Math.pow(AIR_DAMPING, dt * 120);
      b.vx *= damp; b.vy *= damp;
      if (Math.abs(this._angVel) > 0.05 && d > 1) {
        const nx = b.x / d, ny = b.y / d, tx = -ny, ty = nx;
        const drag = (this._angVel * d - (b.vx * tx + b.vy * ty)) * SURFACE_FRICTION * dt;
        b.vx += tx * drag; b.vy += ty * drag;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      this._collideRim(b); this._collideHub(b); this._collideLabelWall(b); this._collideDividers(b);
    }
    this._ballBall();
    for (const b of this._balls) {
      if (b.settled) continue;
      const d = Math.sqrt(b.x * b.x + b.y * b.y);
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const inPockets = d >= POCKET_INNER && d <= LABEL_OUTER;
      if (spd < SETTLE_SPEED && Math.abs(this._angVel) < SETTLE_ANG_VEL && inPockets) {
        b.timer += dt; if (b.timer >= SETTLE_TIME) this._settle(b);
      } else b.timer = 0;
    }
  }

  _peg() {
    // Throttle more aggressively when wheel is slow (avoid end-spam)
    const minInterval = Math.abs(this._angVel) > 2 ? 0.04 : 0.15;
    if (this._time - this._lastPeg < minInterval) return;
    // Mute entirely when wheel is nearly stopped
    if (Math.abs(this._angVel) < 0.5) return;
    this._lastPeg = this._time;
    if (this.onPegHit) this.onPegHit();
  }

  _collideRim(b) {
    const d = Math.sqrt(b.x * b.x + b.y * b.y);
    const max = RIM_R - BALL_RADIUS;
    if (d <= max) return;
    const nx = b.x / d, ny = b.y / d;
    b.x = nx * max; b.y = ny * max;
    const dot = b.vx * nx + b.vy * ny;
    b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
    b.vx *= RESTITUTION; b.vy *= RESTITUTION;
    this._peg();
  }

  _collideHub(b) {
    const d = Math.sqrt(b.x * b.x + b.y * b.y);
    const min = this.R * HUB_COLLIDE_P + BALL_RADIUS;
    if (d >= min || d === 0) return;
    const nx = b.x / d, ny = b.y / d;
    b.x = nx * min; b.y = ny * min;
    const dot = b.vx * nx + b.vy * ny;
    b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
    b.vx *= RESTITUTION; b.vy *= RESTITUTION;
    this._peg();
  }

  _collideLabelWall(b) {
    // Disabled — gravity boost handles settling through number ring
  }

  _collideDividers(b) {
    // Disabled — dividers caused balls to get stuck
  }

  _line(b, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    if (len2 < 0.01) return false;
    const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / len2));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    const ex = b.x - cx, ey = b.y - cy;
    const dist = Math.sqrt(ex * ex + ey * ey);
    const minD = BALL_RADIUS + DIVIDER_W;
    if (dist >= minD || dist < 0.01) return false;
    const nx = ex / dist, ny = ey / dist;
    b.x += nx * (minD - dist); b.y += ny * (minD - dist);
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; b.vx *= RESTITUTION; b.vy *= RESTITUTION; return true; }
    return false;
  }

  _ballBall() {
    for (let i = 0; i < this._balls.length; i++) {
      if (this._balls[i].settled) continue;
      for (let j = i + 1; j < this._balls.length; j++) {
        if (this._balls[j].settled) continue;
        const a = this._balls[i], bb = this._balls[j];
        const dx = a.x - bb.x, dy = a.y - bb.y;
        const d = Math.sqrt(dx * dx + dy * dy), minD = BALL_RADIUS * 2;
        if (d >= minD || d < 0.01) continue;
        const nx = dx / d, ny = dy / d, ov = (minD - d) / 2 + 0.3;
        a.x += nx * ov; a.y += ny * ov; bb.x -= nx * ov; bb.y -= ny * ov;
        const dvx = a.vx - bb.vx, dvy = a.vy - bb.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) continue;
        a.vx -= dot * nx * 0.85; a.vy -= dot * ny * 0.85;
        bb.vx += dot * nx * 0.85; bb.vy += dot * ny * 0.85;
      }
    }
  }

  _settle(b) {
    b.settled = true;
    const c = Math.cos(-this._angle), s = Math.sin(-this._angle);
    b.localX = c * b.x - s * b.y; b.localY = s * b.x + c * b.y;
    let wa = Math.atan2(b.y, b.x) - this._angle;
    wa = ((wa % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const tw = this._data.reduce((ss, w) => ss + w.weight, 0);
    let acc = 0, idx = this._data.length - 1;
    for (let i = 0; i < this._data.length; i++) {
      const sa = (this._data[i].weight / tw) * Math.PI * 2;
      if (wa < acc + sa) { idx = i; break; }
      acc += sa;
    }
    this._results.push(idx);
    if (this._balls.every(bb => bb.settled)) {
      this._angVel = 0;
      clearTimeout(this._spinTimeout);
      if (this._onDone) { const cb = this._onDone; this._onDone = null; cb(this._results); }
    }
  }

  // ═══════════════════════════════════════════
  //  PIXEL ART RENDERING — direct on context
  // ═══════════════════════════════════════════

  /** Draw the wheel centered at (cx, cy) on the given context.
   *  @param {number} pox  peripheral offset X (gauge + slots parallax)
   *  @param {number} poy  peripheral offset Y
   */
  draw(ctx, cx, cy, pox = 0, poy = 0, layers = null) {
    const data = this._data;
    if (!data.length) return;
    const tw = data.reduce((s, w) => s + w.weight, 0);

    // ── 3D perspective tilt (compress Y — hub-to-rim only) ──
    const TILT_Y = Math.abs(this._tilt);
    this._frameLights = [];

    if (TILT_Y < 0.01) {
      // Edge-on (mid-flip): skip wheel, still draw orbit slots
      this._drawOrbitSlots(ctx, cx + pox, cy + poy);
      return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, TILT_Y);
    ctx.translate(-cx, -cy);

    // ── Flipped: draw forge shop face ──
    if (this._tilt < 0) {
      this._drawForgeFace(ctx, cx, cy);
      ctx.restore(); // end tilt
      this._drawGauges(ctx, cx + pox, cy + poy);
      this._drawOrbitSlots(ctx, cx + pox, cy + poy);
      return;
    }

    // ── Layer parallax offsets (relative to wheel center) ──
    const pkOx = layers ? layers.pocket.x : 0;
    const pkOy = layers ? layers.pocket.y : 0;
    const lbOx = layers ? layers.label.x : 0;
    const lbOy = layers ? layers.label.y : 0;
    const rmOx = layers ? layers.rim.x : 0;
    const rmOy = layers ? layers.rim.y : 0;

    // Precompute shared state for highlights / chase
    const isIdle = Math.abs(this._angVel) < 0.1
      && !this._balls.some(b => !b.settled)
      && this._highlights.length === 0;
    const showChase = isIdle || this._bonusMode;
    const chaseTrail = this._bonusMode ? 6 : 4;
    const chaseSpeed = this._bonusMode ? 18 : 6;
    const RAINBOW = [PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple, PAL.neonPink];
    const chasePos = this._time * chaseSpeed;
    const chaseIdx = Math.floor(chasePos) % data.length;

    // ═══ PASS 1: Pockets — slowest parallax ═══
    ctx.save();
    ctx.translate(cx + pkOx, cy + pkOy);
    ctx.rotate(this._angle);

    let off = 0;
    for (let i = 0; i < data.length; i++) {
      const seg = data[i], angle = (seg.weight / tw) * Math.PI * 2;
      const isBlue = seg.symbolId === 'blue';
      const isGold = seg.symbolId === 'gold';
      const dark = i % 2 === 0;
      const mid = off + angle / 2;

      // Pocket fill
      ctx.beginPath();
      ctx.arc(0, 0, POCKET_OUTER, off, off + angle);
      ctx.arc(0, 0, POCKET_INNER, off + angle, off, true);
      ctx.closePath();
      ctx.fillStyle = isGold ? PAL.darkGold : (dark ? SEG_A : SEG_B);
      ctx.fill();

      // Pocket highlight flash
      const hl = this._highlights.find(h => h.idx === i);
      if (hl) {
        const hlColor = isGold ? PAL.gold : PAL.white;
        let a;
        if (hl.t < 0.15) a = 0.9;
        else if (hl.t < 0.4) a = 0.7;
        else a = Math.max(0, 1 - (hl.t - 0.4) / 1.1) * 0.5;
        ctx.fillStyle = hlColor;
        ctx.globalAlpha = a;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Light source for glow
        const worldA = this._angle + mid;
        const hlR = (POCKET_INNER + POCKET_OUTER) / 2;
        this._frameLights.push({
          x: (cx + pkOx) + Math.cos(worldA) * hlR,
          y: (cy + pkOy) + Math.sin(worldA) * hlR * TILT_Y,
          r: 25, color: hlColor,
          a: Math.max(0, 1 - hl.t / 1.5) * 0.35,
        });
      } else if (showChase) {
        for (let t = 0; t < chaseTrail; t++) {
          const ti = ((chaseIdx - t) % data.length + data.length) % data.length;
          if (ti === i) {
            let hlColor;
            if (this._bonusMode) {
              hlColor = RAINBOW[(Math.floor(chasePos) + t) % RAINBOW.length];
            } else {
              hlColor = isGold ? PAL.gold : PAL.white;
            }
            const fade = 1 - t / chaseTrail;
            ctx.fillStyle = hlColor;
            ctx.globalAlpha = 0.35 * fade * fade;
            ctx.fill();
            ctx.globalAlpha = 1;

            if (t === 0) {
              const worldA = this._angle + mid;
              const hlR = (POCKET_INNER + POCKET_OUTER) / 2;
              this._frameLights.push({
                x: (cx + pkOx) + Math.cos(worldA) * hlR,
                y: (cy + pkOy) + Math.sin(worldA) * hlR * TILT_Y,
                r: 18, color: hlColor, a: this._bonusMode ? 0.3 : 0.2,
              });
            }
          }
        }
      }

      off += angle;
    }

    ctx.restore(); // end pocket pass

    // ═══ PASS 2: Number ring + dividers — medium parallax ═══
    ctx.save();
    ctx.translate(cx + lbOx, cy + lbOy);
    ctx.rotate(this._angle);

    off = 0;
    for (let i = 0; i < data.length; i++) {
      const seg = data[i], angle = (seg.weight / tw) * Math.PI * 2;
      const dark = i % 2 === 0;
      const mid = off + angle / 2;

      // Label ring fill (casino red/black)
      ctx.beginPath();
      ctx.arc(0, 0, LABEL_OUTER, off, off + angle);
      ctx.arc(0, 0, LABEL_INNER, off + angle, off, true);
      ctx.closePath();
      ctx.fillStyle = dark ? PAL.darkRed : PAL.black;
      ctx.fill();
      ctx.strokeStyle = PAL.black; ctx.lineWidth = 0.5; ctx.stroke();

      // Label highlight flash (drawn AFTER fill so it's visible)
      const hl = this._highlights.find(h => h.idx === i);
      if (hl) {
        const isBlue = seg.symbolId === 'blue';
        const hlColor = isBlue ? PAL.blue : PAL.white;
        let a;
        if (hl.t < 0.15) a = 0.9;
        else if (hl.t < 0.4) a = 0.7;
        else a = Math.max(0, 1 - (hl.t - 0.4) / 1.1) * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, LABEL_OUTER, off, off + angle);
        ctx.arc(0, 0, LABEL_INNER, off + angle, off, true);
        ctx.closePath();
        ctx.fillStyle = hlColor;
        ctx.globalAlpha = a;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Number (bitmap font)
      const numR = this.R * LABEL_P;
      ctx.save();
      ctx.translate(Math.cos(mid) * numR, Math.sin(mid) * numR);
      ctx.rotate(mid + Math.PI / 2);
      drawTextCentered(ctx, String(i + 1), 0, -Math.floor(CHAR_H / 2), PAL.white, 1);
      ctx.restore();

      // Divider (gold 1px)
      const dcos = Math.cos(off), dsin = Math.sin(off);
      ctx.beginPath();
      ctx.moveTo(dcos * POCKET_INNER, dsin * POCKET_INNER);
      ctx.lineTo(dcos * LABEL_OUTER, dsin * LABEL_OUTER);
      ctx.strokeStyle = DIVIDER_COLOR; ctx.lineWidth = 1; ctx.stroke();

      off += angle;
    }

    ctx.restore(); // end label pass

    // ═══ PASS 3: Rim border — fastest wheel parallax ═══
    ctx.beginPath(); ctx.arc(cx + rmOx, cy + rmOy, RIM_R, 0, Math.PI * 2);
    ctx.strokeStyle = RIM_COLOR; ctx.lineWidth = 1; ctx.stroke();

    // ═══ PASS 4: Balls + Hub — base wheel position ═══
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._angle);

    // ── Placed balls that finished dropping (rotate with wheel) ──
    if (!this._inGauge) {
      for (const pb of this._placedBalls) {
        if (this._dropping) {
          const elapsed = this._dropClock - pb.dropDelay;
          if (elapsed < pb.dropDur) continue; // still ejecting
        }
        this._drawPixelBall(ctx, pb.localX, pb.localY, false);
      }
    }

    // ── Settled balls (rotate with wheel) ──
    for (const b of this._balls) {
      if (!b.settled || b.localX === undefined) continue;
      this._drawPixelBall(ctx, b.localX, b.localY, true);
    }

    // ── Hub circle ──
    ctx.beginPath(); ctx.arc(0, 0, HUB_R, 0, Math.PI * 2);
    ctx.fillStyle = HUB_BG; ctx.fill();
    ctx.strokeStyle = HUB_BORDER; ctx.lineWidth = 1; ctx.stroke();

    this._drawHubScreen(ctx, 0, 0);

    ctx.restore(); // end base pass

    // ── Gauge (ball magazine) ──
    this._drawGauges(ctx, cx + pox, cy + poy);

    // ── Active balls (world space) ──
    for (const b of this._balls) {
      if (b.settled) continue;
      this._drawPixelBall(ctx, cx + b.x, cy + b.y, false);
      this._frameLights.push({
        x: cx + b.x, y: cy + b.y * this.tilt,
        r: 10, color: PAL.white, a: 0.12,
      });
    }

    ctx.restore(); // end tilt

    // ── Relic slots orbiting outside rim (not affected by flip) ──
    this._drawOrbitSlots(ctx, cx + pox, cy + poy);
  }

  // ═══ Forge Shop Face (back of wheel) ═══

  static RARITY_COLORS = {
    common:    { fg: PAL.lightGray, bg: PAL.midGray,    border: PAL.lightGray, sprite: 'relic_common' },
    uncommon:  { fg: PAL.green,     bg: PAL.darkGreen,  border: PAL.green,     sprite: 'relic_uncommon' },
    rare:      { fg: PAL.blue,      bg: PAL.darkBlue,   border: PAL.cyan,      sprite: 'relic_rare' },
    legendary: { fg: PAL.neonPink,  bg: PAL.darkPurple, border: PAL.gold,      sprite: 'relic_legendary' },
  };

  _drawForgeFace(ctx, cx, cy) {
    const shop = this._shop;

    // Buy flash timer
    if (shop.buyFlashTimer > 0) {
      shop.buyFlashTimer -= 1 / 60;
    }

    // ── Background: forge texture disc (pre-rendered, cached) ──
    if (!this._forgeBgCanvas) this._initForgeBackground();
    ctx.drawImage(this._forgeBgCanvas, cx - this._forgeBgOff, cy - this._forgeBgOff);

    // ── 4 quadrant arcs with 2 empty slots each ──
    const QUAD_GAP = 0.10;          // radians gap between quadrants
    const SLOT_GAP = 0.04;          // radians gap between 2 slots in a quadrant
    const QUAD_SPAN = Math.PI / 2 - QUAD_GAP;
    const SLOT_SPAN = (QUAD_SPAN - SLOT_GAP) / 2;
    const slotInner = HUB_R + 3;
    const slotOuter = RIM_R - 3;
    const slotMidR = (slotInner + slotOuter) / 2;

    // Quadrant start angles: top-right, bottom-right, bottom-left, top-left
    const quadStarts = [
      -Math.PI / 2 + QUAD_GAP / 2,
       0            + QUAD_GAP / 2,
       Math.PI / 2  + QUAD_GAP / 2,
       Math.PI      + QUAD_GAP / 2,
    ];

    for (let q = 0; q < 4; q++) {
      const qStart = quadStarts[q];
      for (let s = 0; s < 2; s++) {
        const slotIdx = q * 2 + s;
        const a0 = qStart + s * (SLOT_SPAN + SLOT_GAP);
        const a1 = a0 + SLOT_SPAN;
        const mid = a0 + SLOT_SPAN / 2;
        const isHover = shop.hoverIdx === slotIdx;
        const isBuyFlash = shop.buyFlash === slotIdx && shop.buyFlashTimer > 0;

        // Slot outline (subtle, no opaque fill)
        ctx.beginPath();
        ctx.arc(cx, cy, slotOuter, a0, a1);
        ctx.arc(cx, cy, slotInner, a1, a0, true);
        ctx.closePath();
        ctx.strokeStyle = PAL.midGray;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Check if this slot is the reroll button (slot 4 = bottom-left)
        if (slotIdx === 4) {
          const isRerollHover = shop.hoverIdx === 'reroll';
          const rerollAfford = shop.currency >= shop.rerollCost;

          // Tinted fill
          ctx.beginPath();
          ctx.arc(cx, cy, slotOuter - 1, a0, a1);
          ctx.arc(cx, cy, slotInner + 1, a1, a0, true);
          ctx.closePath();
          ctx.fillStyle = PAL.darkGray;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Border
          ctx.beginPath();
          ctx.arc(cx, cy, slotOuter, a0, a1);
          ctx.arc(cx, cy, slotInner, a1, a0, true);
          ctx.closePath();
          ctx.strokeStyle = PAL.lightGray;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Reroll sprite
          const rx = cx + Math.cos(mid) * slotMidR;
          const ry = cy + Math.sin(mid) * slotMidR;
          if (!rerollAfford) ctx.globalAlpha = 0.35;
          drawSpriteCentered(ctx, 'reroll', Math.round(rx), Math.round(ry), 2);
          ctx.globalAlpha = 1;

          // Price below sprite
          const priceR = slotMidR + 10;
          const rpx = cx + Math.cos(mid) * priceR;
          const rpy = cy + Math.sin(mid) * priceR;
          const priceColor = rerollAfford ? PAL.gold : PAL.darkRed;
          drawTextCentered(ctx, String(shop.rerollCost), Math.round(rpx), Math.round(rpy) - Math.floor(CHAR_H / 2), priceColor, 1);

          // Hover highlight
          if (isRerollHover && rerollAfford) {
            ctx.beginPath();
            ctx.arc(cx, cy, slotOuter, a0, a1);
            ctx.arc(cx, cy, slotInner, a1, a0, true);
            ctx.closePath();
            ctx.fillStyle = PAL.white;
            ctx.globalAlpha = 0.12;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          continue;
        }

        // Check if this slot has an offering
        const offering = shop.offerings[slotIdx];

        if (offering) {
          const rarity = PixelWheel.RARITY_COLORS[offering.rarity] || PixelWheel.RARITY_COLORS.common;
          const tooExpensive = shop.currency < offering.finalCost;

          // Semi-transparent tinted fill
          ctx.beginPath();
          ctx.arc(cx, cy, slotOuter - 1, a0, a1);
          ctx.arc(cx, cy, slotInner + 1, a1, a0, true);
          ctx.closePath();
          ctx.fillStyle = rarity.bg;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Rarity border highlight
          ctx.beginPath();
          ctx.arc(cx, cy, slotOuter, a0, a1);
          ctx.arc(cx, cy, slotInner, a1, a0, true);
          ctx.closePath();
          ctx.strokeStyle = rarity.border;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Sprite at slot center
          const sx = cx + Math.cos(mid) * slotMidR;
          const sy = cy + Math.sin(mid) * slotMidR;
          if (isBuyFlash) {
            ctx.globalAlpha = Math.min(1, shop.buyFlashTimer / 0.2);
          } else if (tooExpensive) {
            ctx.globalAlpha = 0.35;
          }
          drawSpriteCentered(ctx, rarity.sprite, Math.round(sx), Math.round(sy), 2);
          ctx.globalAlpha = 1;

          // Price below sprite
          const priceR = slotMidR + 14;
          const px = cx + Math.cos(mid) * priceR;
          const py = cy + Math.sin(mid) * priceR;
          const priceStr = String(offering.finalCost);
          const priceColor = tooExpensive ? PAL.darkRed : PAL.gold;
          const textW = measureText(priceStr);
          const gap = 2;
          const ticketW = SPRITE_SIZE;
          const totalW = textW + gap + ticketW;
          const startX = Math.round(px - totalW / 2);
          const textY = Math.round(py) - Math.floor(CHAR_H / 2);
          drawText(ctx, priceStr, startX, textY, priceColor, 1);
          drawSpriteCentered(ctx, 'ticket', startX + textW + gap + Math.floor(ticketW / 2), Math.round(py), 1);

          // Hover highlight
          if (isHover && !tooExpensive) {
            ctx.beginPath();
            ctx.arc(cx, cy, slotOuter, a0, a1);
            ctx.arc(cx, cy, slotInner, a1, a0, true);
            ctx.closePath();
            ctx.fillStyle = PAL.white;
            ctx.globalAlpha = 0.12;
            ctx.fill();
            ctx.globalAlpha = 1;

            this._frameLights.push({
              x: sx, y: sy * Math.abs(this._tilt),
              r: 20, color: rarity.fg, a: 0.25,
            });
          }

          // Buy flash
          if (isBuyFlash) {
            ctx.beginPath();
            ctx.arc(cx, cy, slotOuter, a0, a1);
            ctx.arc(cx, cy, slotInner, a1, a0, true);
            ctx.closePath();
            ctx.fillStyle = PAL.gold;
            ctx.globalAlpha = shop.buyFlashTimer / 0.4 * 0.6;
            ctx.fill();
            ctx.globalAlpha = 1;

            this._frameLights.push({
              x: sx, y: sy * Math.abs(this._tilt),
              r: 40, color: PAL.gold, a: shop.buyFlashTimer / 0.4 * 0.5,
            });
          }
        } else {
          // Empty slot — faint dot at center
          const ex = cx + Math.cos(mid) * slotMidR;
          const ey = cy + Math.sin(mid) * slotMidR;
          ctx.fillStyle = PAL.midGray;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
          ctx.globalAlpha = 1;
        }
      }

      // Quadrant divider lines (radial spokes at quad boundaries)
      const dAngle = quadStarts[q] - QUAD_GAP / 2;
      const dc = Math.cos(dAngle), ds = Math.sin(dAngle);
      ctx.beginPath();
      ctx.moveTo(cx + dc * slotInner, cy + ds * slotInner);
      ctx.lineTo(cx + dc * slotOuter, cy + ds * slotOuter);
      ctx.strokeStyle = PAL.midGray;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Hub center: single CONTINUER button ──
    const hubR = HUB_R;
    const leaveHover = shop.hoverIdx === 'leave';

    ctx.beginPath();
    ctx.arc(cx, cy, hubR - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = PAL.darkGray;
    ctx.globalAlpha = leaveHover ? 0.8 : 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = leaveHover ? PAL.lightGray : PAL.midGray;
    ctx.lineWidth = 1;
    ctx.stroke();
    drawSpriteCentered(ctx, 'arrow_right', cx, Math.round(cy - 4), 1);
    drawTextCentered(ctx, 'CONTINUER', cx, Math.round(cy + 4), PAL.lightGray, 1);
  }


  _drawPixelBall(ctx, bx, by, settled) {
    drawSpriteCentered(ctx, 'ball', Math.round(bx), Math.round(by), 1);
  }

  _drawHubScreen(ctx, cx, cy) {
    const h = this._hub;
    const r = HUB_R - 3;
    if (r < 5) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Score with coin icon (coin on right)
    const scoreStr = String(h.score);
    const scoreW = scoreStr.length * CHAR_H;
    const coinSz = SPRITE_SIZE;
    const totalW = scoreW + 2 + coinSz;
    drawTextCentered(ctx, scoreStr, Math.round(cx - totalW / 2 + scoreW / 2), Math.round(cy - r * 0.25), PAL.gold, 1);
    drawAnimSpriteCentered(ctx, 'coin', Math.round(cx - totalW / 2 + scoreW + 2 + coinSz / 2), Math.round(cy - r * 0.25 + CHAR_H / 2), 1, this._time, 6);

    // Last symbol sprite
    if (h.lastSymbolId && h.valueFade > 0) {
      ctx.globalAlpha = Math.min(1, h.valueFade);
      drawSpriteCentered(ctx, h.lastSymbolId, cx, Math.round(cy + 2), 2);
      ctx.globalAlpha = 1;
    }

    // History row (colored pips)
    if (h.history.length > 0) {
      const total = h.history.length;
      const spacing = Math.min(6, Math.floor((r * 1.4) / total));
      const startX = Math.round(cx - ((total - 1) * spacing) / 2);
      const histY = Math.round(cy + r * 0.55);
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = h.history[i] === 'blue' ? PAL.blue : PAL.lightGray;
        ctx.fillRect(startX + i * spacing, histY, 3, 3);
      }
    }

    // Streak
    if (h.streak > 1) {
      drawTextCentered(ctx, 'X' + h.streak, cx, Math.round(cy + r * 0.75), PAL.red, 1);
    }

    // Fever
    if (h.fever) {
      const col = Math.sin(this._time * 8) > 0 ? PAL.red : PAL.gold;
      drawTextCentered(ctx, 'FEVER', cx, Math.round(cy - r * 0.6), col, 1);
    }

    // Value flash with coin icon (coin on right)
    if (h.valueFade > 0) {
      ctx.globalAlpha = Math.min(1, h.valueFade);
      const valStr = '+' + h.lastValue;
      const valW2 = valStr.length * CHAR_H;
      const coinSz2 = SPRITE_SIZE;
      const tw2 = valW2 + 2 + coinSz2;
      drawTextCentered(ctx, valStr, Math.round(cx - tw2 / 2 + valW2 / 2), Math.round(cy + r * 0.05), PAL.green, 1);
      drawAnimSpriteCentered(ctx, 'coin', Math.round(cx - tw2 / 2 + valW2 + 2 + coinSz2 / 2), Math.round(cy + r * 0.05 + CHAR_H / 2), 1, this._time, 6);
      ctx.globalAlpha = 1;
    }

    // Message flash
    if (h.messageFade > 0) {
      ctx.globalAlpha = Math.min(1, h.messageFade);
      drawTextCentered(ctx, h.message, cx, Math.round(cy - r * 0.45), PAL.gold, 1);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  setCounters(gold, tickets) {
    this._counterGold = gold;
    this._counterTickets = tickets;
  }

  _drawGauges(ctx, cx, cy) {
    for (let g = 0; g < GAUGE_CONFIGS.length; g++) {
      if (g === 1 || g === 2) continue; // removed: top & bottom gauges
      this._drawOneGauge(ctx, cx, cy, g);
    }
    this._drawRimCounters(ctx, cx, cy);
  }

  _drawOneGauge(ctx, cx, cy, gaugeIdx) {
    const cfg = GAUGE_CONFIGS[gaugeIdx];
    const unlocked = this._gaugeUnlocks[gaugeIdx];
    const INNER = RIM_R + 16;
    const OUTER = RIM_R + 21;

    // Channel fill
    ctx.beginPath();
    ctx.arc(cx, cy, OUTER, cfg.start, cfg.end);
    ctx.arc(cx, cy, INNER, cfg.end, cfg.start, true);
    ctx.closePath();
    ctx.fillStyle = unlocked ? SEG_B : PAL.black;
    ctx.fill();

    // Borders
    ctx.strokeStyle = unlocked ? RIM_COLOR : PAL.midGray;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, OUTER, cfg.start, cfg.end); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, INNER, cfg.start, cfg.end); ctx.stroke();
    for (const a of [cfg.start, cfg.end]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * INNER, cy + Math.sin(a) * INNER);
      ctx.lineTo(cx + Math.cos(a) * OUTER, cy + Math.sin(a) * OUTER);
      ctx.stroke();
    }

    // ── Corruption gauge (gauge 3) ──
    if (gaugeIdx === 3) {
      this._drawCorruptionGauge(ctx, cx, cy, cfg, INNER, OUTER);
      return;
    }

    if (!unlocked) {
      // Lock indicator (X) at center of gauge arc
      const midA = (cfg.start + cfg.end) / 2;
      const midR = (INNER + OUTER) / 2;
      const lx = Math.round(cx + Math.cos(midA) * midR);
      const ly = Math.round(cy + Math.sin(midA) * midR);
      ctx.fillStyle = PAL.midGray;
      ctx.fillRect(lx - 1, ly - 1, 1, 1);
      ctx.fillRect(lx + 1, ly - 1, 1, 1);
      ctx.fillRect(lx, ly, 1, 1);
      ctx.fillRect(lx - 1, ly + 1, 1, 1);
      ctx.fillRect(lx + 1, ly + 1, 1, 1);
      return;
    }

    // Balls still in this gauge
    const gaugeBalls = this._inGauge ? this._placedBalls :
                       this._ejecting ? this._ejectQueue : [];
    for (const pb of gaugeBalls) {
      if (pb.gaugeIdx !== gaugeIdx) continue;
      const bx = Math.round(cx + pb.gaugeX);
      const by = Math.round(cy + pb.gaugeY);
      ctx.fillStyle = PAL.black;
      ctx.fillRect(bx - 4, by - 3, 7, 7);
      this._drawPixelBall(ctx, bx, by, false);
      this._frameLights.push({
        x: cx + pb.gaugeX, y: cy + pb.gaugeY * this.tilt,
        r: 6, color: PAL.white, a: 0.06,
      });
    }

    // Ball count label just past the arc end
    let ballCount = 0;
    for (const pb of gaugeBalls) { if (pb.gaugeIdx === gaugeIdx) ballCount++; }
    if (ballCount > 0) {
      const la = cfg.end + 0.12;
      const lr = (INNER + OUTER) / 2;
      const lx = Math.round(cx + Math.cos(la) * lr);
      const ly = Math.round(cy + Math.sin(la) * lr);
      drawTextCentered(ctx, String(ballCount), lx, ly - Math.floor(CHAR_H / 2), PAL.white, 1);
    }
  }

  _drawCorruptionGauge(ctx, cx, cy, cfg, INNER, OUTER) {
    const fill = this._corruption; // 0..1
    const totalArc = cfg.end - cfg.start;
    const fillEnd = cfg.start + totalArc * fill;

    // Background (empty part)
    ctx.beginPath();
    ctx.arc(cx, cy, OUTER, cfg.start, cfg.end);
    ctx.arc(cx, cy, INNER, cfg.end, cfg.start, true);
    ctx.closePath();
    ctx.fillStyle = PAL.darkPurple;
    ctx.fill();

    // Filled part
    if (fill > 0.001) {
      ctx.beginPath();
      ctx.arc(cx, cy, OUTER, cfg.start, fillEnd);
      ctx.arc(cx, cy, INNER, fillEnd, cfg.start, true);
      ctx.closePath();
      ctx.fillStyle = fill >= 0.85 ? PAL.neonPink : PAL.purple;
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = fill >= 0.85 ? PAL.neonPink : PAL.purple;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, OUTER, cfg.start, cfg.end); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, INNER, cfg.start, cfg.end); ctx.stroke();
    for (const a of [cfg.start, cfg.end]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * INNER, cy + Math.sin(a) * INNER);
      ctx.lineTo(cx + Math.cos(a) * OUTER, cy + Math.sin(a) * OUTER);
      ctx.stroke();
    }

    // Fill edge tick mark
    if (fill > 0.01 && fill < 0.99) {
      ctx.strokeStyle = PAL.white;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(fillEnd) * INNER, cy + Math.sin(fillEnd) * INNER);
      ctx.lineTo(cx + Math.cos(fillEnd) * OUTER, cy + Math.sin(fillEnd) * OUTER);
      ctx.stroke();
    }

    // Glow at high corruption
    if (fill >= 0.85) {
      const midA = (cfg.start + fillEnd) / 2;
      const midR = (INNER + OUTER) / 2;
      this._frameLights.push({
        x: cx + Math.cos(midA) * midR,
        y: cy + Math.sin(midA) * midR * Math.abs(this._tilt),
        r: 12, color: PAL.neonPink, a: 0.15,
      });
    }

    // Skull icon centered radially outside the gauge
    const skullR = OUTER + 8;
    const sx = Math.round(cx + Math.cos(cfg.center) * skullR);
    const sy = Math.round(cy + Math.sin(cfg.center) * skullR);
    drawSpriteCentered(ctx, 'skull', sx, sy, 1);
  }

  _drawRimCounters(ctx, cx, cy) {
    const cfg = GAUGE_CONFIGS[2]; // bottom position
    const INNER = RIM_R + 16;
    const OUTER = RIM_R + 21;
    const MID_R = (INNER + OUTER) / 2;
    const arcLen = cfg.end - cfg.start; // 0.60 rad

    // ── Border arcs ──
    ctx.strokeStyle = PAL.midGray;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, OUTER, cfg.start, cfg.end); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, INNER, cfg.start, cfg.end); ctx.stroke();
    for (const a of [cfg.start, cfg.end]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * INNER, cy + Math.sin(a) * INNER);
      ctx.lineTo(cx + Math.cos(a) * OUTER, cy + Math.sin(a) * OUTER);
      ctx.stroke();
    }

    // ── Divider line at center of arc ──
    const midA = cfg.center;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(midA) * INNER, cy + Math.sin(midA) * INNER);
    ctx.lineTo(cx + Math.cos(midA) * OUTER, cy + Math.sin(midA) * OUTER);
    ctx.stroke();

    // ── Gold counter (left half) ──
    const goldA = cfg.start + arcLen * 0.25;
    const gx = Math.round(cx + Math.cos(goldA) * MID_R);
    const gy = Math.round(cy + Math.sin(goldA) * MID_R);
    const goldTxt = String(this._counterGold);
    const goldTW = measureText(goldTxt);
    const gap = 2;
    const goldTotalW = goldTW + gap + SPRITE_SIZE;
    const gsx = gx - Math.floor(goldTotalW / 2);
    drawText(ctx, goldTxt, gsx, gy - Math.floor(CHAR_H / 2), PAL.gold, 1);
    drawAnimSpriteCentered(ctx, 'coin', gsx + goldTW + gap + Math.floor(SPRITE_SIZE / 2), gy, 1, this._time, 6);

    // ── Ticket counter (right half) ──
    const tickA = cfg.start + arcLen * 0.75;
    const tx = Math.round(cx + Math.cos(tickA) * MID_R);
    const ty = Math.round(cy + Math.sin(tickA) * MID_R);
    const tickTxt = String(this._counterTickets);
    const tickTW = measureText(tickTxt);
    const tickTotalW = tickTW + gap + SPRITE_SIZE;
    const tsx = tx - Math.floor(tickTotalW / 2);
    drawText(ctx, tickTxt, tsx, ty - Math.floor(CHAR_H / 2), PAL.green, 1);
    drawSpriteCentered(ctx, 'ticket', tsx + tickTW + gap + Math.floor(SPRITE_SIZE / 2) + 2, ty - 1, 1);
  }

  _drawOrbitSlots(ctx, cx, cy) {
    const INNER = RIM_R + 5;           // small gap outside rim
    const OUTER = RIM_R + 27;          // slot band thickness
    const SLOT_ARC = 0.28;             // ~16° per slot
    const PAIR_GAP = 0.06;             // gap between two slots of a pair

    // 4 diagonal corners, 2 slots each
    const corners = [
      -Math.PI * 3 / 4,  // top-left
      -Math.PI / 4,       // top-right
       Math.PI / 4,       // bottom-right
       Math.PI * 3 / 4,  // bottom-left
    ];

    let idx = 0;
    for (const center of corners) {
      // Slot A (left of center)
      const a0A = center - PAIR_GAP / 2 - SLOT_ARC;
      const a1A = center - PAIR_GAP / 2;
      this._drawOneSlot(ctx, cx, cy, INNER, OUTER, a0A, a1A, idx++);

      // Slot B (right of center)
      const a0B = center + PAIR_GAP / 2;
      const a1B = center + PAIR_GAP / 2 + SLOT_ARC;
      this._drawOneSlot(ctx, cx, cy, INNER, OUTER, a0B, a1B, idx++);
    }
  }

  _drawOneSlot(ctx, cx, cy, inner, outer, a0, a1, idx) {
    const filled = this._slots && this._slots[idx];
    const locked = idx >= 2; // only top-left pair (0,1) unlocked

    // Arc fill (black background)
    ctx.beginPath();
    ctx.arc(cx, cy, outer, a0, a1);
    ctx.arc(cx, cy, inner, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = PAL.black;
    ctx.fill();

    // Gray border arcs + radial dividers
    ctx.strokeStyle = PAL.midGray; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, outer, a0, a1); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, inner, a0, a1); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner);
    ctx.lineTo(cx + Math.cos(a0) * outer, cy + Math.sin(a0) * outer);
    ctx.moveTo(cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner);
    ctx.lineTo(cx + Math.cos(a1) * outer, cy + Math.sin(a1) * outer);
    ctx.stroke();

    // Content
    const midAngle = (a0 + a1) / 2;
    const midR = (inner + outer) / 2;
    const mx = Math.round(cx + Math.cos(midAngle) * midR);
    const my = Math.round(cy + Math.sin(midAngle) * midR);

    if (filled) {
      try {
        drawSpriteCentered(ctx, filled.id || 'ticket', mx, my, 1);
      } catch {
        drawTextCentered(ctx, '?', mx, my - Math.floor(CHAR_H / 2), PAL.gold, 1);
      }
    } else if (locked) {
      // Cross (X) for locked
      ctx.fillStyle = PAL.midGray;
      ctx.fillRect(mx - 1, my - 1, 1, 1);
      ctx.fillRect(mx + 1, my - 1, 1, 1);
      ctx.fillRect(mx, my, 1, 1);
      ctx.fillRect(mx - 1, my + 1, 1, 1);
      ctx.fillRect(mx + 1, my + 1, 1, 1);
    } else {
      // Unlocked empty: dim dot
      ctx.fillStyle = PAL.midGray;
      ctx.fillRect(mx, my, 1, 1);
    }
  }
}
