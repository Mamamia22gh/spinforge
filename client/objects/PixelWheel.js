import { getSymbol } from '../../src/data/symbols.js';
import { PAL, SYM_COLORS, SEG_A, SEG_B, DIVIDER_COLOR, HUB_BG, HUB_BORDER, RIM_COLOR } from '../gfx/PaletteDB.js';
import { drawTextCentered, CHAR_H } from '../gfx/BitmapFont.js';
import { drawSpriteCentered, SPRITE_SIZE } from '../gfx/PixelSprites.js';

// ── Layout (proportional to wheel radius R) ──
const HUB_P = 0.28;
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
const SPIN_MIN = 14;
const SPIN_MAX = 20;
const SPIN_DECEL = 0.9975;
const GRAVITY_BOOST_THRESHOLD = 2.5;
const GRAVITY_BOOST_MAX = 6;

// ── 3D perspective tilt ──
const TILT_Y = 0.55;  // vertical compression (1 = flat, 0.5 = ~60°)

export class PixelWheel {
  constructor() {
    // Fixed physics radius — independent of canvas
    this.R = 150;
    this._updateRadii();

    this._data = [];
    this._angle = 0;
    this._angVel = 0;
    this._balls = [];
    this._placedBalls = [];
    this._results = [];
    this._onDone = null;
    this._acc = 0;
    this._time = 0;
    this._highlights = [];
    this.onPegHit = null;
    this._lastPeg = 0;

    // Hub screen state
    this._hub = {
      lastSymbolId: '', lastValue: 0, valueFade: 0,
      streak: 0, multi: 1, fever: false,
      history: [],
      message: '', messageFade: 0,
      score: 0, scoreTarget: 0,
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
  }

  setWheel(data) {
    this._data = data;
    this._balls = [];
    this._placedBalls = [];
    this._results = [];
    this._highlights = [];
  }

  placeBalls(n) {
    this._placedBalls = [];
    this._balls = [];
    this._results = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const r = LABEL_OUTER + 2 + Math.random() * (RIM_R - LABEL_OUTER - BALL_RADIUS * 2 - 3);
      this._placedBalls.push({ localX: Math.cos(a) * r, localY: Math.sin(a) * r });
    }
  }

  spin() {
    return new Promise(resolve => {
      this._angVel = SPIN_MIN + Math.random() * (SPIN_MAX - SPIN_MIN);
      this._results = [];
      this._onDone = resolve;
      this._balls = this._placedBalls.map(pb => {
        const c = Math.cos(this._angle), s = Math.sin(this._angle);
        const wx = c * pb.localX - s * pb.localY;
        const wy = s * pb.localX + c * pb.localY;
        return { x: wx, y: wy, vx: -wy * this._angVel * 0.7, vy: wx * this._angVel * 0.7, settled: false, timer: 0 };
      });
      this._placedBalls = [];
      this._spinTimeout = setTimeout(() => {
        if (!this._onDone) return;
        for (const b of this._balls) {
          if (!b.settled) this._settle(b);
        }
      }, 8000);
    });
  }

  highlight(idx) { this._highlights.push({ idx, t: 0 }); }
  get spinning() { return this._angVel > 0.05 || this._balls.some(b => !b.settled); }
  get speed() { return Math.abs(this._angVel); }

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
      this._collideRim(b); this._collideHub(b); this._collideDividers(b);
    }
    this._ballBall();
    for (const b of this._balls) {
      if (b.settled) continue;
      const d = Math.sqrt(b.x * b.x + b.y * b.y);
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const inPockets = d >= POCKET_INNER && d <= POCKET_OUTER;
      if (spd < SETTLE_SPEED && Math.abs(this._angVel) < SETTLE_ANG_VEL && inPockets) {
        b.timer += dt; if (b.timer >= SETTLE_TIME) this._settle(b);
      } else b.timer = 0;
    }
  }

  _peg() {
    const min = Math.abs(this._angVel) > 2 ? 0.04 : 0.15;
    if (Math.abs(this._angVel) < 0.5) return;
    if (this._time - this._lastPeg < min) return;
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
  }

  _collideHub(b) {
    const d = Math.sqrt(b.x * b.x + b.y * b.y);
    const min = HUB_R + BALL_RADIUS;
    if (d >= min || d === 0) return;
    const nx = b.x / d, ny = b.y / d;
    b.x = nx * min; b.y = ny * min;
    const dot = b.vx * nx + b.vy * ny;
    b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
    b.vx *= RESTITUTION; b.vy *= RESTITUTION;
    this._peg();
  }

  _collideDividers(b) {
    if (!this._data.length) return;
    const d = Math.sqrt(b.x * b.x + b.y * b.y);
    if (d > POCKET_OUTER + 2) return;
    const tw = this._data.reduce((s, w) => s + w.weight, 0);
    let off = 0;
    for (const seg of this._data) {
      const a = off + this._angle;
      const c = Math.cos(a), s = Math.sin(a);
      if (this._line(b, c * POCKET_INNER, s * POCKET_INNER, c * POCKET_OUTER, s * POCKET_OUTER)) this._peg();
      off += (seg.weight / tw) * Math.PI * 2;
    }
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

  /** Draw the wheel centered at (cx, cy) on the given context. */
  draw(ctx, cx, cy) {
    const data = this._data;
    if (!data.length) return;
    const tw = data.reduce((s, w) => s + w.weight, 0);

    // ── 3D perspective tilt (compress Y) ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, TILT_Y);
    ctx.translate(-cx, -cy);

    // ── Rim ──
    ctx.beginPath(); ctx.arc(cx, cy, RIM_R, 0, Math.PI * 2);
    ctx.strokeStyle = RIM_COLOR; ctx.lineWidth = 1; ctx.stroke();

    // ── Rotated wheel ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._angle);

    let off = 0;
    for (let i = 0; i < data.length; i++) {
      const seg = data[i], angle = (seg.weight / tw) * Math.PI * 2;
      const sym = getSymbol(seg.symbolId);
      const symCol = SYM_COLORS[sym.color] || { fg: PAL.lightGray, bg: PAL.midGray };
      const dark = i % 2 === 0;
      const mid = off + angle / 2;

      // ── Pocket (flat fill) ──
      ctx.beginPath();
      ctx.arc(0, 0, POCKET_OUTER, off, off + angle);
      ctx.arc(0, 0, POCKET_INNER, off + angle, off, true);
      ctx.closePath();
      ctx.fillStyle = dark ? SEG_A : SEG_B;
      ctx.fill();

      // Highlight flash
      const hl = this._highlights.find(h => h.idx === i);
      if (hl) {
        let a, fillCol;
        if (hl.t < 0.15) { a = 0.9; fillCol = PAL.white; }
        else if (hl.t < 0.4) { a = 0.7; fillCol = symCol.fg; }
        else { a = Math.max(0, 1 - (hl.t - 0.4) / 1.1) * 0.5; fillCol = symCol.fg; }
        ctx.fillStyle = fillCol;
        ctx.globalAlpha = a;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, LABEL_OUTER, off, off + angle);
        ctx.arc(0, 0, LABEL_INNER, off + angle, off, true);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Number ring (casino red/black) ──
      ctx.beginPath();
      ctx.arc(0, 0, LABEL_OUTER, off, off + angle);
      ctx.arc(0, 0, LABEL_INNER, off + angle, off, true);
      ctx.closePath();
      ctx.fillStyle = dark ? PAL.darkRed : PAL.black;
      ctx.fill();
      ctx.strokeStyle = PAL.black; ctx.lineWidth = 0.5; ctx.stroke();

      // Number (bitmap font)
      const numR = this.R * LABEL_P;
      ctx.save();
      ctx.translate(Math.cos(mid) * numR, Math.sin(mid) * numR);
      ctx.rotate(mid + Math.PI / 2);
      drawTextCentered(ctx, String(i + 1), 0, -Math.floor(CHAR_H / 2), PAL.white, 1);
      ctx.restore();

      // ── Divider (gold 1px) ──
      const dcos = Math.cos(off), dsin = Math.sin(off);
      ctx.beginPath();
      ctx.moveTo(dcos * POCKET_INNER, dsin * POCKET_INNER);
      ctx.lineTo(dcos * LABEL_OUTER, dsin * LABEL_OUTER);
      ctx.strokeStyle = DIVIDER_COLOR; ctx.lineWidth = 1; ctx.stroke();

      off += angle;
    }

    // ── Placed balls (rotate with wheel) ──
    for (const pb of this._placedBalls) this._drawPixelBall(ctx, pb.localX, pb.localY, false);

    // ── Settled balls (rotate with wheel) ──
    for (const b of this._balls) {
      if (!b.settled || b.localX === undefined) continue;
      this._drawPixelBall(ctx, b.localX, b.localY, true);
    }

    // ── Hub circle ──
    ctx.beginPath(); ctx.arc(0, 0, HUB_R, 0, Math.PI * 2);
    ctx.fillStyle = HUB_BG; ctx.fill();
    ctx.strokeStyle = HUB_BORDER; ctx.lineWidth = 1; ctx.stroke();

    ctx.restore(); // end rotation

    // ── Active balls (world space) ──
    for (const b of this._balls) {
      if (b.settled) continue;
      this._drawPixelBall(ctx, cx + b.x, cy + b.y, false);
    }

    // ── Hub Screen (fixed, screen coords) ──
    this._drawHubScreen(ctx, cx, cy);

    ctx.restore(); // end tilt
  }

  _drawPixelBall(ctx, bx, by, settled) {
    const px = Math.round(bx);
    const py = Math.round(by);
    const col = settled ? PAL.gold : PAL.white;
    const sh = settled ? PAL.darkGold : PAL.lightGray;
    ctx.fillStyle = col;
    ctx.fillRect(px, py - 1, 1, 1);
    ctx.fillRect(px - 1, py, 3, 1);
    ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(px - 1, py - 1, 1, 1);
    ctx.fillStyle = sh;
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }

  _drawHubScreen(ctx, cx, cy) {
    const h = this._hub;
    const r = HUB_R - 3;
    if (r < 5) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Score
    drawTextCentered(ctx, String(h.score), cx, Math.round(cy - r * 0.25), PAL.gold, 1);

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
        try {
          const sym = getSymbol(h.history[i]);
          const col = SYM_COLORS[sym.color] || { fg: PAL.lightGray };
          ctx.fillStyle = col.fg;
        } catch { ctx.fillStyle = PAL.lightGray; }
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

    // Value flash
    if (h.valueFade > 0) {
      ctx.globalAlpha = Math.min(1, h.valueFade);
      drawTextCentered(ctx, '+' + h.lastValue, cx, Math.round(cy + r * 0.05), PAL.green, 1);
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
}
