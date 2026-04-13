import { getSymbol } from '../../src/data/symbols.js';

const COLORS = {
  red: '#00ff44',  blue: '#00cc66',  gold: '#33ff99',
  green: '#00ff66', purple: '#00aa55', white: '#44ffaa',
  void: '#008833',  wild: '#00ff88',
};
const NEON_BORDER = '#00ff66';
const NEON_GOLD = '#33ff99';

// ── Physics ──
const BOWL_GRAVITY = 320;
const BALL_RADIUS = 8;
const RESTITUTION = 0.5;
const AIR_DAMPING = 0.997;
const SURFACE_FRICTION = 180;
const SETTLE_SPEED = 15;
const SETTLE_ANG_VEL = 0.3;
const SETTLE_TIME = 0.25;
const DIVIDER_W = 2;
const PHYSICS_DT = 1 / 120;
const SPIN_MIN = 14;
const SPIN_MAX = 20;
const SPIN_DECEL = 0.9975;

export class NeonWheel {
  constructor() {
    this.R = 0; // set on first draw based on canvas size
    this._data = [];
    this._angle = 0;
    this._angVel = 0;
    this._balls = [];        // { x, y, vx, vy, settled, timer, localX?, localY? }
    this._placedBalls = [];   // { localX, localY }
    this._results = [];
    this._onDone = null;
    this._acc = 0;
    this._time = 0;
    this._highlights = [];    // { idx, t }
    this.onPegHit = null;
    this._lastPeg = 0;
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
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = this.R * 0.25 + Math.random() * this.R * 0.35;
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
        return {
          x: wx, y: wy,
          vx: -wy * this._angVel,
          vy: wx * this._angVel,
          settled: false, timer: 0,
        };
      });
      this._placedBalls = [];
    });
  }

  highlight(idx) {
    this._highlights.push({ idx, t: 0 });
  }

  get spinning() { return this._angVel > 0.05 || this._balls.some(b => !b.settled); }
  get speed() { return Math.abs(this._angVel); }

  // ── Physics ──
  update(dt) {
    this._time += dt;
    for (let i = this._highlights.length - 1; i >= 0; i--) {
      this._highlights[i].t += dt;
      if (this._highlights[i].t > 1.5) this._highlights.splice(i, 1);
    }
    this._acc += dt;
    while (this._acc >= PHYSICS_DT) { this._step(PHYSICS_DT); this._acc -= PHYSICS_DT; }
  }

  _step(dt) {
    if (Math.abs(this._angVel) > 0.01) {
      this._angVel *= Math.pow(SPIN_DECEL, dt * 120);
      this._angle += this._angVel * dt;
    } else this._angVel = 0;

    for (const b of this._balls) {
      if (b.settled) continue;
      const d = Math.sqrt(b.x * b.x + b.y * b.y);
      if (d > 1) { b.vx -= (b.x / d) * BOWL_GRAVITY * dt; b.vy -= (b.y / d) * BOWL_GRAVITY * dt; }
      const damp = Math.pow(AIR_DAMPING, dt * 120);
      b.vx *= damp; b.vy *= damp;
      if (Math.abs(this._angVel) > 0.05 && d > 1) {
        const nx = b.x / d, ny = b.y / d, tx = -ny, ty = nx;
        const drag = (this._angVel * d - (b.vx * tx + b.vy * ty)) * SURFACE_FRICTION * dt;
        b.vx += tx * drag; b.vy += ty * drag;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      this._rim(b); this._hub(b); this._divs(b);
    }
    this._ballBall();
    for (const b of this._balls) {
      if (b.settled) continue;
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (spd < SETTLE_SPEED && Math.abs(this._angVel) < SETTLE_ANG_VEL) {
        b.timer += dt;
        if (b.timer >= SETTLE_TIME) this._settle(b);
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

  _rim(b) {
    const d = Math.sqrt(b.x * b.x + b.y * b.y);
    const max = this.R - BALL_RADIUS - 4;
    if (d <= max) return;
    const nx = b.x / d, ny = b.y / d;
    b.x = nx * max; b.y = ny * max;
    const dot = b.vx * nx + b.vy * ny;
    b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
    b.vx *= RESTITUTION; b.vy *= RESTITUTION;
    if (Math.abs(this._angVel) > 0.1) {
      const tx = -ny, ty = nx;
      const drag = (this._angVel * max - (b.vx * tx + b.vy * ty)) * SURFACE_FRICTION * PHYSICS_DT;
      b.vx += tx * drag; b.vy += ty * drag;
    }
  }

  _hub(b) {
    const d = Math.sqrt(b.x * b.x + b.y * b.y);
    const min = this.R * 0.14 + BALL_RADIUS;
    if (d >= min || d === 0) return;
    const nx = b.x / d, ny = b.y / d;
    b.x = nx * min; b.y = ny * min;
    const dot = b.vx * nx + b.vy * ny;
    b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
    b.vx *= RESTITUTION; b.vy *= RESTITUTION;
    this._peg();
  }

  _divs(b) {
    if (!this._data.length) return;
    const tw = this._data.reduce((s, w) => s + w.weight, 0);
    let off = 0;
    for (const seg of this._data) {
      const a = off + this._angle;
      const iR = this.R * 0.16, oR = this.R - 8;
      const c = Math.cos(a), s = Math.sin(a);
      if (this._line(b, c * iR, s * iR, c * oR, s * oR)) this._peg();
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
        const nx = dx / d, ny = dy / d, ov = (minD - d) / 2 + 0.5;
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
      if (this._onDone) { const cb = this._onDone; this._onDone = null; cb(this._results); }
    }
  }

  // ── Drawing ──
  draw(ctx, cx, cy, radius) {
    this.R = radius;
    const data = this._data;
    if (!data.length) return;
    const tw = data.reduce((s, w) => s + w.weight, 0);

    // Outer glow ring
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = NEON_BORDER; ctx.lineWidth = 2;
    ctx.shadowColor = NEON_BORDER; ctx.shadowBlur = 20;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();

    // Wheel (rotated)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._angle);

    let off = 0;
    for (let i = 0; i < data.length; i++) {
      const seg = data[i], angle = (seg.weight / tw) * Math.PI * 2;
      const sym = getSymbol(seg.symbolId);
      const col = COLORS[sym.color] || '#888';
      const dark = i % 2 === 0;

      // Segment
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, off, off + angle); ctx.closePath();
      ctx.fillStyle = dark ? '#000a02' : '#001a06';
      ctx.fill();

      // Color fill (green tint)
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Highlight flash
      const hl = this._highlights.find(h => h.idx === i);
      if (hl) {
        const a = Math.max(0, 1 - hl.t / 1.5) * 0.5;
        ctx.fillStyle = `rgba(255,255,200,${a})`; ctx.fill();
      }

      // Neon border
      ctx.strokeStyle = '#00ff6644'; ctx.lineWidth = 1;
      ctx.stroke();

      // Number
      const mid = off + angle / 2;
      const nr = radius * 0.85;
      ctx.save();
      ctx.translate(Math.cos(mid) * nr, Math.sin(mid) * nr);
      ctx.rotate(mid + Math.PI / 2);
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00ff66';
      ctx.fillText(String(i + 1), 0, 0);
      ctx.restore();

      // Emoji
      const er = radius * 0.58;
      ctx.save();
      ctx.translate(Math.cos(mid) * er, Math.sin(mid) * er);
      ctx.rotate(-this._angle);
      ctx.font = `${Math.floor(radius * 0.1)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym.emoji, 0, 0);
      ctx.restore();

      off += angle;
    }

    // Placed balls (rotate with wheel)
    for (const pb of this._placedBalls) this._drawBall(ctx, pb.localX, pb.localY);

    // Settled balls (local coords)
    for (const b of this._balls) {
      if (!b.settled || b.localX === undefined) continue;
      this._drawBall(ctx, b.localX, b.localY, true);
    }

    // Hub
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#001a06';
    ctx.fill();
    ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff66'; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.shadowBlur = 0;

    ctx.restore(); // end rotation

    // Active balls (world space)
    for (const b of this._balls) {
      if (b.settled) continue;
      this._drawBall(ctx, cx + b.x, cy + b.y);
    }

    // Pointer
    ctx.save();
    ctx.translate(cx, cy - radius - 6);
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-10, -4); ctx.lineTo(10, -4); ctx.closePath();
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66'; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#00aa44'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  _drawBall(ctx, bx, by, settled = false) {
    // Glow
    ctx.beginPath(); ctx.arc(bx, by, BALL_RADIUS + 4, 0, Math.PI * 2);
    ctx.fillStyle = settled ? 'rgba(0,255,100,0.08)' : 'rgba(0,255,100,0.05)';
    ctx.fill();
    // Ball body
    ctx.beginPath(); ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66'; ctx.shadowBlur = 6;
    ctx.fill(); ctx.shadowBlur = 0;
    // Inner
    ctx.beginPath(); ctx.arc(bx, by, BALL_RADIUS - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#003311';
    ctx.fill();
    // Spec
    ctx.beginPath(); ctx.arc(bx - 1.5, by - 2, BALL_RADIUS * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#66ffaa'; ctx.fill();
  }
}
