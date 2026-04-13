import * as THREE from 'three';

// ── Physics constants (model space × 100) ──
const BOWL_RADIUS = 42;         // inner edge of pockets
const HUB_RADIUS = 6;           // turret exclusion zone
const BALL_RADIUS = 1.5;        // visual + physics radius
const BALL_Y = 9.5;             // height above model origin (on disc surface)
const GRAVITY_TOWARD_CENTER = 800; // bowl pull
const FRICTION = 0.992;         // per-frame velocity damping
const SURFACE_DRAG = 60;        // tangential drag from spinning wheel
const RESTITUTION = 0.5;
const SETTLE_SPEED = 3;
const SETTLE_TIME = 0.3;
const DT = 1 / 120;

/**
 * 3D ball physics inside the roulette wheel.
 * Balls live in the wheel's local XZ plane at a fixed Y height.
 * Bowl gravity pulls toward center. Dividers and rim provide collisions.
 */
export class WheelBalls {
  constructor(scene, wheelGroup) {
    this._scene = scene;
    this._wheelGroup = wheelGroup; // the model group (for coordinate transforms)
    this._balls = [];              // { mesh, x, z, vx, vz, settled, settleTimer, placed }
    this._wheelAngVel = 0;
    this._wheelAngle = 0;
    this._dividers = [];           // { angle } — rebuilt from wheel data
    this._accumulator = 0;
    this._onAllSettled = null;
    this._settledResults = [];

    // Shared geometry + material
    this._ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 16, 12);
    this._ballMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.15,
      metalness: 0.95,
      emissive: 0xffffff,
      emissiveIntensity: 0.05,
    });
  }

  /**
   * Rebuild divider angles from wheel data.
   */
  setWheelData(wheelData) {
    this._dividers = [];
    const totalWeight = wheelData.reduce((s, w) => s + w.weight, 0);
    let angle = 0;
    for (const seg of wheelData) {
      this._dividers.push({ angle });
      angle += (seg.weight / totalWeight) * Math.PI * 2;
    }
    this._wheelData = wheelData;
  }

  /**
   * Place N balls on the wheel (parented to spinning disc).
   */
  placeBalls(count, spinParts) {
    this.clearBalls();

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const r = HUB_RADIUS + 4 + Math.random() * (BOWL_RADIUS - HUB_RADIUS - 8);

      const mesh = new THREE.Mesh(this._ballGeo, this._ballMat.clone());
      mesh.castShadow = true;

      // Position in model-local space (before scale)
      const localX = Math.cos(a) * r / 100;
      const localZ = Math.sin(a) * r / 100;
      const localY = BALL_Y / 100;

      mesh.position.set(localX, localY, localZ);
      mesh.scale.setScalar(1 / 100); // counter the model's 100x scale

      // Parent to the first spin part (inside disc) so it rotates with wheel
      if (spinParts.length > 0) {
        spinParts[0].add(mesh);
      }

      this._balls.push({
        mesh,
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        vx: 0, vz: 0,
        settled: false,
        settleTimer: 0,
        placed: true,       // still parented to disc
        parentPart: spinParts[0] || null,
      });
    }
  }

  /**
   * Release balls into physics. The wheel starts spinning.
   * Returns promise with array of segment indices when all settle.
   */
  startSpin(angVel, spinParts) {
    return new Promise(resolve => {
      this._wheelAngVel = angVel;
      this._wheelAngle = 0;
      this._settledResults = [];
      this._onAllSettled = resolve;

      for (const ball of this._balls) {
        if (!ball.placed) continue;

        // Un-parent from disc → re-parent to scene
        if (ball.parentPart) {
          // Get world position before un-parenting
          const wp = new THREE.Vector3();
          ball.mesh.getWorldPosition(wp);
          ball.parentPart.remove(ball.mesh);
          this._scene.add(ball.mesh);
          ball.mesh.position.copy(wp);
          ball.mesh.scale.setScalar(1.5); // world scale for ball
        }

        // Give tangential velocity from wheel rotation
        const dist = Math.sqrt(ball.x * ball.x + ball.z * ball.z);
        if (dist > 0) {
          const nx = ball.x / dist;
          const nz = ball.z / dist;
          // Tangential = perpendicular to radius
          ball.vx = -nz * angVel * dist * 0.8;
          ball.vz =  nx * angVel * dist * 0.8;
        }

        ball.placed = false;
        ball.settled = false;
        ball.settleTimer = 0;
      }
    });
  }

  /**
   * Step physics + sync meshes.
   */
  update(dt) {
    this._accumulator += dt;
    while (this._accumulator >= DT) {
      this._step(DT);
      this._accumulator -= DT;
    }

    // Sync mesh positions for active balls
    for (const ball of this._balls) {
      if (ball.placed || ball.settled) continue;

      // Convert physics coords to world position
      // The model is at (0, 0.85, 0) scaled 100x
      // Physics coords are in "scaled model space" (multiplied by 100)
      const wx = ball.x / 100 * 100; // = ball.x (it's already in world-ish units at scale 100)
      const wz = ball.z / 100 * 100;
      // Actually: model pos + local * scale
      // model at (0, 0.85, 0), scale 100
      // local pos in model = (ball.x/100, BALL_Y/100, ball.z/100)
      // world pos = modelPos + local * 100 = (ball.x, 0.85 + BALL_Y, ball.z)
      ball.mesh.position.set(ball.x / 100 * 100, 0.85 + BALL_Y / 100 * 100, ball.z / 100 * 100);
      // Simplify: physics x,z are already at model*100 scale
      ball.mesh.position.set(ball.x * 0.01 * 100, 0.85 + BALL_Y * 0.01 * 100, ball.z * 0.01 * 100);
    }
  }

  _step(dt) {
    // Wheel deceleration
    if (Math.abs(this._wheelAngVel) > 0.01) {
      this._wheelAngVel *= 0.998;
      this._wheelAngle += this._wheelAngVel * dt;
    } else {
      this._wheelAngVel = 0;
    }

    for (const ball of this._balls) {
      if (ball.placed || ball.settled) continue;

      // Bowl gravity — pull toward center
      const dist = Math.sqrt(ball.x * ball.x + ball.z * ball.z);
      if (dist > 1) {
        ball.vx -= (ball.x / dist) * GRAVITY_TOWARD_CENTER * dt;
        ball.vz -= (ball.z / dist) * GRAVITY_TOWARD_CENTER * dt;
      }

      // Friction
      ball.vx *= FRICTION;
      ball.vz *= FRICTION;

      // Surface drag from spinning wheel
      if (Math.abs(this._wheelAngVel) > 0.05 && dist > 1) {
        const nx = ball.x / dist;
        const nz = ball.z / dist;
        const tx = -nz; // tangent
        const tz = nx;
        const surfSpeed = this._wheelAngVel * dist;
        const ballTanSpeed = ball.vx * tx + ball.vz * tz;
        const drag = (surfSpeed - ballTanSpeed) * SURFACE_DRAG * dt;
        ball.vx += tx * drag;
        ball.vz += tz * drag;
      }

      // Integrate
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;

      // Rim collision
      this._collideRim(ball);
      // Hub collision
      this._collideHub(ball);
      // Divider collisions
      this._collideDividers(ball);
    }

    // Ball-ball collisions
    for (let i = 0; i < this._balls.length; i++) {
      if (this._balls[i].placed || this._balls[i].settled) continue;
      for (let j = i + 1; j < this._balls.length; j++) {
        if (this._balls[j].placed || this._balls[j].settled) continue;
        this._collideBallPair(this._balls[i], this._balls[j]);
      }
    }

    // Settle check
    for (const ball of this._balls) {
      if (ball.placed || ball.settled) continue;
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
      if (speed < SETTLE_SPEED && Math.abs(this._wheelAngVel) < 0.3) {
        ball.settleTimer += dt;
        if (ball.settleTimer >= SETTLE_TIME) {
          this._settleBall(ball);
        }
      } else {
        ball.settleTimer = 0;
      }
    }
  }

  _collideRim(ball) {
    const dist = Math.sqrt(ball.x * ball.x + ball.z * ball.z);
    const maxR = BOWL_RADIUS - BALL_RADIUS;
    if (dist <= maxR) return;

    const nx = ball.x / dist;
    const nz = ball.z / dist;
    ball.x = nx * maxR;
    ball.z = nz * maxR;

    const dot = ball.vx * nx + ball.vz * nz;
    ball.vx -= 2 * dot * nx;
    ball.vz -= 2 * dot * nz;
    ball.vx *= RESTITUTION;
    ball.vz *= RESTITUTION;
  }

  _collideHub(ball) {
    const dist = Math.sqrt(ball.x * ball.x + ball.z * ball.z);
    const minR = HUB_RADIUS + BALL_RADIUS;
    if (dist >= minR || dist < 0.1) return;

    const nx = ball.x / dist;
    const nz = ball.z / dist;
    ball.x = nx * minR;
    ball.z = nz * minR;

    const dot = ball.vx * nx + ball.vz * nz;
    ball.vx -= 2 * dot * nx;
    ball.vz -= 2 * dot * nz;
    ball.vx *= RESTITUTION;
    ball.vz *= RESTITUTION;
  }

  _collideDividers(ball) {
    for (const div of this._dividers) {
      const worldAngle = div.angle + this._wheelAngle;
      const cos = Math.cos(worldAngle);
      const sin = Math.sin(worldAngle);

      // Divider line from hub to rim
      const x1 = cos * HUB_RADIUS;
      const z1 = sin * HUB_RADIUS;
      const x2 = cos * BOWL_RADIUS;
      const z2 = sin * BOWL_RADIUS;

      this._collideLineSegment(ball, x1, z1, x2, z2);
    }
  }

  _collideLineSegment(ball, x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.01) return;

    const t = Math.max(0, Math.min(1,
      ((ball.x - x1) * dx + (ball.z - z1) * dz) / lenSq
    ));

    const cx = x1 + t * dx;
    const cz = z1 + t * dz;
    const distX = ball.x - cx;
    const distZ = ball.z - cz;
    const dist = Math.sqrt(distX * distX + distZ * distZ);
    const minDist = BALL_RADIUS + 0.5;

    if (dist >= minDist || dist < 0.01) return;

    const nx = distX / dist;
    const nz = distZ / dist;
    ball.x += nx * (minDist - dist);
    ball.z += nz * (minDist - dist);

    const dot = ball.vx * nx + ball.vz * nz;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vz -= 2 * dot * nz;
      ball.vx *= RESTITUTION;
      ball.vz *= RESTITUTION;
    }
  }

  _collideBallPair(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = BALL_RADIUS * 2;
    if (dist >= minDist || dist < 0.01) return;

    const nx = dx / dist;
    const nz = dz / dist;
    const overlap = (minDist - dist) / 2 + 0.2;
    a.x += nx * overlap;
    a.z += nz * overlap;
    b.x -= nx * overlap;
    b.z -= nz * overlap;

    const dvx = a.vx - b.vx;
    const dvz = a.vz - b.vz;
    const dot = dvx * nx + dvz * nz;
    if (dot > 0) return;

    a.vx -= dot * nx * 0.85;
    a.vz -= dot * nz * 0.85;
    b.vx += dot * nx * 0.85;
    b.vz += dot * nz * 0.85;
  }

  _settleBall(ball) {
    ball.settled = true;
    ball.vx = 0;
    ball.vz = 0;

    // Determine which segment it landed in
    let worldAngle = Math.atan2(ball.z, ball.x);
    let localAngle = worldAngle - this._wheelAngle;
    localAngle = ((localAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    const data = this._wheelData;
    const totalWeight = data.reduce((s, w) => s + w.weight, 0);
    let accum = 0;
    let segIdx = data.length - 1;

    for (let i = 0; i < data.length; i++) {
      const segAngle = (data[i].weight / totalWeight) * Math.PI * 2;
      if (localAngle < accum + segAngle) { segIdx = i; break; }
      accum += segAngle;
    }

    this._settledResults.push(segIdx);

    // Check if all balls settled
    if (this._balls.every(b => b.placed || b.settled)) {
      this._wheelAngVel = 0;
      if (this._onAllSettled) {
        const cb = this._onAllSettled;
        this._onAllSettled = null;
        cb(this._settledResults);
      }
    }
  }

  clearBalls() {
    for (const ball of this._balls) {
      if (ball.mesh.parent) ball.mesh.parent.remove(ball.mesh);
    }
    this._balls = [];
    this._settledResults = [];
  }

  get wheelAngVel() { return this._wheelAngVel; }
  get wheelAngle() { return this._wheelAngle; }
}
