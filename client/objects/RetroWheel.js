import { getSymbol } from '../../src/data/symbols.js';

const COLORS = {
  red: '#cc2233', blue: '#2244cc', gold: '#d4a520',
  green: '#22aa44', purple: '#8833cc', white: '#ccccee',
  void: '#330055', wild: '#ff44ff',
};

// ── Physics constants ──
const BOWL_GRAVITY = 350;       // pull toward center (roulette bowl shape)
const BALL_RADIUS = 7;
const RESTITUTION = 0.55;
const AIR_DAMPING = 0.997;
const SURFACE_FRICTION = 200;
const SETTLE_SPEED = 15;
const SETTLE_ANG_VEL = 0.3;
const SETTLE_TIME = 0.25;
const PEG_RADIUS = 3;
const DIVIDER_HALF_W = 2;
const PHYSICS_DT = 1 / 120;

// ── Wheel spin feel ──
const SPIN_INITIAL_MIN = 14;
const SPIN_INITIAL_MAX = 20;
const SPIN_DECEL = 0.9975;       // per physics step — long satisfying casino spin

/**
 * 2D canvas-drawn retro roulette wheel with real ball physics.
 * Balls bounce on dividers/pegs, settle into segments → outcome.
 */
export class RetroWheel {
  constructor() {
    this.RADIUS = 160;

    this._wheelData = [];
    this._wheelAngle = 0;
    this._wheelAngVel = 0;

    // Balls sitting on the wheel (local coords, rotate with wheel)
    this._placedBalls = [];  // { localX, localY }

    // Active physics balls (world coords)
    this._activeBalls = [];  // { x, y, vx, vy, settled, settleTimer, trail, localX?, localY? }

    // Results
    this._settledResults = [];  // segment indices
    this._onAllSettled = null;

    this._physicsAccum = 0;

    // Peg hit callback for sfx
    this.onPegHit = null;
    this._lastPegHitTime = 0;

    this._time = 0;
    this._lastValue = null;
    this._flashTimer = 0;

    // Segment highlight animation
    this._highlights = [];  // { segmentIndex, timer, maxTime }
  }

  updateWheel(data) {
    this._wheelData = data;
    this._placedBalls = [];
    this._activeBalls = [];
    this._settledResults = [];
    this._lastValue = null;
    this._highlights = [];
  }

  resetBalls() {
    this._placedBalls = [];
    this._activeBalls = [];
    this._settledResults = [];
    this._lastValue = null;
    this._highlights = [];
  }

  /** Current wheel angular velocity (for audio pitch) */
  get wheelSpeed() {
    return Math.abs(this._wheelAngVel);
  }

  /**
   * Place N balls on the wheel surface. They sit there and rotate with the wheel.
   */
  placeBalls(count) {
    this._placedBalls = [];
    this._activeBalls = [];
    this._settledResults = [];
    this._highlights = [];

    const R = this.RADIUS;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = R * 0.35 + Math.random() * R * 0.35;
      this._placedBalls.push({
        localX: Math.cos(angle) * r,
        localY: Math.sin(angle) * r,
      });
    }
  }

  /**
   * Start the wheel spinning. Balls are released into physics.
   * Returns a promise that resolves with an array of segment indices when ALL balls settle.
   */
  startSpin() {
    return new Promise(resolve => {
      this._wheelAngVel = SPIN_INITIAL_MIN + Math.random() * (SPIN_INITIAL_MAX - SPIN_INITIAL_MIN);
      this._settledResults = [];
      this._onAllSettled = resolve;

      // Convert placed balls to active physics balls (wheel-local → world)
      // Give them tangential velocity matching the wheel rotation at their position
      this._activeBalls = this._placedBalls.map(pb => {
        const cos = Math.cos(this._wheelAngle);
        const sin = Math.sin(this._wheelAngle);
        const wx = cos * pb.localX - sin * pb.localY;
        const wy = sin * pb.localX + cos * pb.localY;

        // Tangential velocity = ω × r (perpendicular to radius)
        const angVel = this._wheelAngVel;
        const tvx = -wy * angVel;  // tangent x = -y * ω
        const tvy =  wx * angVel;  // tangent y =  x * ω

        return {
          x: wx,
          y: wy,
          vx: tvx,
          vy: tvy,
          settled: false,
          settleTimer: 0,
          trail: [],
        };
      });

      this._placedBalls = [];
    });
  }

  /**
   * Flash a segment (called during result reveal).
   */
  highlightSegment(segmentIndex) {
    this._highlights.push({ segmentIndex, timer: 0, maxTime: 1.5 });
  }

  showValue(value) {
    this._lastValue = value;
    this._flashTimer = 0;
  }

  get isSpinning() {
    return this._wheelAngVel > 0.05 || this._activeBalls.some(b => !b.settled);
  }

  // ── Physics ──

  update(dt) {
    this._time += dt;
    this._flashTimer += dt;

    // Age highlights
    for (let i = this._highlights.length - 1; i >= 0; i--) {
      this._highlights[i].timer += dt;
      if (this._highlights[i].timer > this._highlights[i].maxTime) {
        this._highlights.splice(i, 1);
      }
    }

    // Age trails
    for (const ball of this._activeBalls) {
      if (ball.settled) continue;
      for (let i = ball.trail.length - 1; i >= 0; i--) {
        ball.trail[i].age += dt;
        if (ball.trail[i].age > 0.3) ball.trail.splice(i, 1);
      }
    }

    this._physicsAccum += dt;
    while (this._physicsAccum >= PHYSICS_DT) {
      this._stepPhysics(PHYSICS_DT);
      this._physicsAccum -= PHYSICS_DT;
    }
  }

  _stepPhysics(dt) {
    // Wheel deceleration — slow, casino-like
    if (Math.abs(this._wheelAngVel) > 0.01) {
      this._wheelAngVel *= Math.pow(SPIN_DECEL, dt * 120);
      this._wheelAngle += this._wheelAngVel * dt;
    } else {
      this._wheelAngVel = 0;
    }

    // Ball physics
    for (const ball of this._activeBalls) {
      if (ball.settled) continue;

      // Trail
      if (this._time - (ball.trail[ball.trail.length - 1]?.birth ?? 0) > 0.02) {
        ball.trail.push({ x: ball.x, y: ball.y, age: 0, birth: this._time });
        if (ball.trail.length > 12) ball.trail.shift();
      }

      // Bowl gravity — pull toward center (like roulette bowl slope)
      const dist = Math.sqrt(ball.x * ball.x + ball.y * ball.y);
      if (dist > 1) {
        const gx = -ball.x / dist * BOWL_GRAVITY;
        const gy = -ball.y / dist * BOWL_GRAVITY;
        ball.vx += gx * dt;
        ball.vy += gy * dt;
      }

      // Air damping
      const damp = Math.pow(AIR_DAMPING, dt * 120);
      ball.vx *= damp;
      ball.vy *= damp;

      // Integrate
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Collisions
      this._collideRim(ball);
      this._collideHub(ball);
      this._collideDividers(ball);
    }

    // Ball-ball collisions (separate pass to avoid order issues)
    this._collideBallsAll();

    // Settle detection
    for (const ball of this._activeBalls) {
      if (ball.settled) continue;

      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed < SETTLE_SPEED && Math.abs(this._wheelAngVel) < SETTLE_ANG_VEL) {
        ball.settleTimer += dt;
        if (ball.settleTimer >= SETTLE_TIME) {
          this._settleBall(ball);
        }
      } else {
        ball.settleTimer = 0;
      }
    }
  }

  _emitPegHit() {
    // Throttle more aggressively when wheel is slow (avoid end-spam)
    const minInterval = Math.abs(this._wheelAngVel) > 2 ? 0.04 : 0.15;
    if (this._time - this._lastPegHitTime < minInterval) return;
    // Mute entirely when wheel is nearly stopped
    if (Math.abs(this._wheelAngVel) < 0.5) return;
    this._lastPegHitTime = this._time;
    if (this.onPegHit) this.onPegHit();
  }

  _collideRim(ball) {
    const dist = Math.sqrt(ball.x * ball.x + ball.y * ball.y);
    const maxR = this.RADIUS - BALL_RADIUS - 6;
    if (dist <= maxR) return;

    const nx = ball.x / dist;
    const ny = ball.y / dist;

    ball.x = nx * maxR;
    ball.y = ny * maxR;

    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.vx *= RESTITUTION;
    ball.vy *= RESTITUTION;

    if (Math.abs(this._wheelAngVel) > 0.1) {
      const tx = -ny;
      const ty = nx;
      const surfaceSpeed = this._wheelAngVel * maxR;
      const ballTanSpeed = ball.vx * tx + ball.vy * ty;
      const drag = (surfaceSpeed - ballTanSpeed) * SURFACE_FRICTION * PHYSICS_DT;
      ball.vx += tx * drag;
      ball.vy += ty * drag;
    }
  }

  _collideHub(ball) {
    const dist = Math.sqrt(ball.x * ball.x + ball.y * ball.y);
    const hubR = this.RADIUS * 0.14 + BALL_RADIUS;
    if (dist >= hubR || dist === 0) return;

    const nx = ball.x / dist;
    const ny = ball.y / dist;

    ball.x = nx * hubR;
    ball.y = ny * hubR;

    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.vx *= RESTITUTION;
    ball.vy *= RESTITUTION;

    this._emitPegHit();
  }

  _collideDividers(ball) {
    const data = this._wheelData;
    if (!data || data.length === 0) return;

    const totalWeight = data.reduce((s, w) => s + w.weight, 0);
    let angleOffset = 0;

    for (let i = 0; i < data.length; i++) {
      const angle = (data[i].weight / totalWeight) * Math.PI * 2;
      const divWorldAngle = angleOffset + this._wheelAngle;

      const innerR = this.RADIUS * 0.16;
      const outerR = this.RADIUS - 10;
      const cos = Math.cos(divWorldAngle);
      const sin = Math.sin(divWorldAngle);
      const x1 = cos * innerR;
      const y1 = sin * innerR;
      const x2 = cos * outerR;
      const y2 = sin * outerR;

      if (this._collideLineSegment(ball, x1, y1, x2, y2)) {
        this._emitPegHit();
      }

      if (this._collidePeg(ball, cos * outerR, sin * outerR)) {
        this._emitPegHit();
      }

      angleOffset += angle;
    }
  }

  _collideBallsAll() {
    const balls = this._activeBalls;
    for (let a = 0; a < balls.length; a++) {
      if (balls[a].settled) continue;
      for (let b = a + 1; b < balls.length; b++) {
        if (balls[b].settled) continue;
        this._collideBallPair(balls[a], balls[b]);
      }
    }
  }

  _collideBallPair(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = BALL_RADIUS * 2;
    if (dist >= minDist || dist < 0.01) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // Push apart (equal)
    const overlap = (minDist - dist) / 2 + 0.5;
    a.x += nx * overlap;
    a.y += ny * overlap;
    b.x -= nx * overlap;
    b.y -= ny * overlap;

    // Relative velocity along collision normal
    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dot = dvx * nx + dvy * ny;
    if (dot > 0) return; // moving apart

    // Impulse (equal mass elastic)
    a.vx -= dot * nx * 0.85;
    a.vy -= dot * ny * 0.85;
    b.vx += dot * nx * 0.85;
    b.vy += dot * ny * 0.85;
  }

  _collideLineSegment(ball, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;

    const t = Math.max(0, Math.min(1,
      ((ball.x - x1) * dx + (ball.y - y1) * dy) / lenSq
    ));

    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    const distX = ball.x - cx;
    const distY = ball.y - cy;
    const dist = Math.sqrt(distX * distX + distY * distY);
    const minDist = BALL_RADIUS + DIVIDER_HALF_W;

    if (dist >= minDist || dist === 0) return false;

    const nx = distX / dist;
    const ny = distY / dist;

    ball.x += nx * (minDist - dist);
    ball.y += ny * (minDist - dist);

    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      ball.vx *= RESTITUTION;
      ball.vy *= RESTITUTION;
      return true;
    }
    return false;
  }

  _collidePeg(ball, px, py) {
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = BALL_RADIUS + PEG_RADIUS;

    if (dist >= minDist || dist === 0) return false;

    const nx = dx / dist;
    const ny = dy / dist;

    ball.x = px + nx * minDist;
    ball.y = py + ny * minDist;

    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      ball.vx *= RESTITUTION * 0.85;
      ball.vy *= RESTITUTION * 0.85;
      return true;
    }
    return false;
  }

  _settleBall(ball) {
    ball.settled = true;
    ball.trail = [];

    // Convert world pos → wheel-local so it rotates with the wheel
    const cos = Math.cos(-this._wheelAngle);
    const sin = Math.sin(-this._wheelAngle);
    ball.localX = cos * ball.x - sin * ball.y;
    ball.localY = sin * ball.x + cos * ball.y;

    const segIdx = this._getSegmentAtPosition(ball.x, ball.y);
    this._settledResults.push(segIdx);

    // Check if ALL balls have settled
    if (this._activeBalls.every(b => b.settled)) {
      // Snap wheel to stop
      this._wheelAngVel = 0;

      if (this._onAllSettled) {
        const cb = this._onAllSettled;
        this._onAllSettled = null;
        cb(this._settledResults);
      }
    }
  }

  _getSegmentAtPosition(wx, wy) {
    let worldAngle = Math.atan2(wy, wx);
    let localAngle = worldAngle - this._wheelAngle;
    localAngle = ((localAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    const data = this._wheelData;
    const totalWeight = data.reduce((s, w) => s + w.weight, 0);
    let accum = 0;

    for (let i = 0; i < data.length; i++) {
      const segAngle = (data[i].weight / totalWeight) * Math.PI * 2;
      if (localAngle < accum + segAngle) return i;
      accum += segAngle;
    }
    return data.length - 1;
  }

  // ── Drawing ──

  draw(ctx, cx, cy, radius) {
    const data = this._wheelData;
    if (!data || data.length === 0) return;

    const R = radius || this.RADIUS;
    const totalWeight = data.reduce((s, w) => s + w.weight, 0);

    // ── Outer ring glow ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#d4a52060';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // ── Wheel (rotated) ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._wheelAngle);

    let angleOffset = 0;
    for (let i = 0; i < data.length; i++) {
      const seg = data[i];
      const angle = (seg.weight / totalWeight) * Math.PI * 2;
      const sym = getSymbol(seg.symbolId);
      const color = COLORS[sym.color] || '#888';

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, angleOffset, angleOffset + angle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
      grad.addColorStop(0, color + '44');
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, color + 'cc');
      ctx.fillStyle = grad;
      ctx.fill();

      // Highlight overlay
      const hl = this._highlights.find(h => h.segmentIndex === i);
      if (hl) {
        const alpha = Math.max(0, 1 - hl.timer / hl.maxTime) * 0.6;
        ctx.fillStyle = `rgba(255,255,200,${alpha})`;
        ctx.fill();
      }

      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();

      angleOffset += angle;
    }

    // ── Placed balls (wheel-local, rotate with wheel) ──
    for (const pb of this._placedBalls) {
      this._drawBall(ctx, pb.localX, pb.localY);
    }

    // ── Settled balls (wheel-local, rotate with wheel) ──
    for (const ball of this._activeBalls) {
      if (!ball.settled || ball.localX === undefined) continue;
      this._drawBall(ctx, ball.localX, ball.localY, true);
    }

    // Center hub
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.12, 0, Math.PI * 2);
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.12);
    hubGrad.addColorStop(0, '#f0c040');
    hubGrad.addColorStop(1, '#8a6a20');
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = '#5a4010';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore(); // end wheel rotation

    // ── Active balls + trails (world space) ──
    for (const ball of this._activeBalls) {
      if (ball.settled) continue;

      // Trail
      for (const pt of ball.trail) {
        const alpha = Math.max(0, 1 - pt.age / 0.3) * 0.35;
        const trailR = BALL_RADIUS * (0.3 + 0.5 * (1 - pt.age / 0.3));
        ctx.beginPath();
        ctx.arc(cx + pt.x, cy + pt.y, trailR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,180,140,${alpha})`;
        ctx.fill();
      }

      // Ball
      this._drawBall(ctx, cx + ball.x, cy + ball.y);
    }

    // ── Pointer (fixed, top center) ──
    ctx.save();
    ctx.translate(cx, cy - R - 4);
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-9, -4);
    ctx.lineTo(9, -4);
    ctx.closePath();
    ctx.fillStyle = '#ff3344';
    ctx.fill();
    ctx.strokeStyle = '#aa1122';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowColor = '#ff3344';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Value flash ──
    if (this._lastValue !== null) {
      const alpha = Math.max(0, 1 - this._flashTimer * 0.5);
      if (alpha > 0) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = `rgba(255,221,68,${alpha})`;
        ctx.shadowColor = '#ffdd44';
        ctx.shadowBlur = 12 * alpha;
        ctx.fillText(`+${this._lastValue}`, cx, cy + R + 34);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }

  _drawBall(ctx, bx, by, settled = false) {
    // Outer glow
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS + 4, 0, Math.PI * 2);
    ctx.fillStyle = settled ? 'rgba(255,220,100,0.12)' : 'rgba(220,200,160,0.15)';
    ctx.fill();

    // Shadow
    ctx.beginPath();
    ctx.arc(bx + 2, by + 2, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Ball — metallic chrome
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
    const bGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, BALL_RADIUS);
    bGrad.addColorStop(0, '#e8e0d0');
    bGrad.addColorStop(0.3, '#b0a898');
    bGrad.addColorStop(0.7, '#807068');
    bGrad.addColorStop(1, '#504840');
    ctx.fillStyle = bGrad;
    ctx.fill();

    // Rim
    ctx.strokeStyle = '#605850';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2.5, BALL_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,240,0.6)';
    ctx.fill();
  }
}
