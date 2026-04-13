import * as THREE from 'three';

/**
 * Roulette ball — orbits the wheel rim, decelerates, bounces off pegs, settles.
 * Runs inside the CRT inner scene.
 */
export class RouletteBall {
  constructor() {
    this.group = new THREE.Group();

    const geo = new THREE.SphereGeometry(0.045, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee, roughness: 0.15, metalness: 0.9,
      emissive: 0xffffff, emissiveIntensity: 0.15,
    });
    this._ball = new THREE.Mesh(geo, mat);
    this._ball.castShadow = true;
    this._ball.visible = false;
    this.group.add(this._ball);

    // Trail glow
    this._glow = new THREE.PointLight(0xffffff, 0, 0.6);
    this.group.add(this._glow);

    // Animation state
    this._active = false;
    this._phase = 'idle';     // idle | orbit | drop | bounce | settle
    this._elapsed = 0;
    this._orbitAngle = 0;
    this._orbitSpeed = 0;
    this._orbitRadius = 0;
    this._targetAngle = 0;
    this._bounceCount = 0;
    this._totalDuration = 0;
    this._settlePos = new THREE.Vector3();
    this._callback = null;
  }

  /**
   * Start ball animation toward target segment.
   * @param {number} targetAngle — world angle of the target segment center
   * @param {number} duration — total spin time (matches wheel)
   * @param {Function} onSettle — called when ball lands
   */
  launch(targetAngle, duration, onSettle) {
    this._ball.visible = true;
    this._active = true;
    this._phase = 'orbit';
    this._elapsed = 0;
    this._orbitAngle = Math.random() * Math.PI * 2;
    this._orbitSpeed = 18 + Math.random() * 4;  // fast initial
    this._orbitRadius = 1.0;
    this._targetAngle = targetAngle;
    this._bounceCount = 0;
    this._totalDuration = duration;
    this._callback = onSettle;
    this._glow.intensity = 1.5;
  }

  hide() {
    this._ball.visible = false;
    this._active = false;
    this._glow.intensity = 0;
  }

  update(dt) {
    if (!this._active) return;
    this._elapsed += dt;

    const t = Math.min(1, this._elapsed / this._totalDuration);

    switch (this._phase) {
      case 'orbit':
        this._updateOrbit(dt, t);
        break;
      case 'drop':
        this._updateDrop(dt, t);
        break;
      case 'bounce':
        this._updateBounce(dt, t);
        break;
      case 'settle':
        this._updateSettle(dt);
        break;
    }
  }

  _updateOrbit(dt, t) {
    // Decelerate orbit speed with easeOutQuart
    const speedFactor = 1 - Math.pow(t, 2.5);
    this._orbitSpeed = 3 + 18 * speedFactor;
    this._orbitAngle += this._orbitSpeed * dt;

    // Radius shrinks slightly
    this._orbitRadius = 1.0 - t * 0.15;

    const x = Math.cos(this._orbitAngle) * this._orbitRadius;
    const z = Math.sin(this._orbitAngle) * this._orbitRadius;
    this._ball.position.set(x, 0.12 + Math.sin(this._elapsed * 30) * 0.005, z);
    this._glow.position.copy(this._ball.position);
    this._glow.intensity = 1.0 + speedFactor * 0.8;

    // Transition to drop when speed is low enough
    if (t > 0.7) {
      this._phase = 'drop';
      this._dropStart = this._elapsed;
    }
  }

  _updateDrop(dt, t) {
    // Spiral inward to landing zone
    const dropT = Math.min(1, (this._elapsed - this._dropStart) / (this._totalDuration * 0.2));
    const ease = 1 - Math.pow(1 - dropT, 3);

    this._orbitSpeed = Math.max(1, this._orbitSpeed - dt * 8);
    this._orbitAngle += this._orbitSpeed * dt;

    // Lerp radius toward target (inner zone ~0.6)
    this._orbitRadius = this._orbitRadius + (0.55 - this._orbitRadius) * ease * 0.1;

    const x = Math.cos(this._orbitAngle) * this._orbitRadius;
    const z = Math.sin(this._orbitAngle) * this._orbitRadius;
    const bounce = Math.abs(Math.sin(this._elapsed * 25)) * 0.015 * (1 - dropT);
    this._ball.position.set(x, 0.10 + bounce, z);
    this._glow.position.copy(this._ball.position);
    this._glow.intensity = 0.6 + (1 - dropT) * 0.4;

    if (dropT >= 1) {
      this._phase = 'bounce';
      this._bounceStart = this._elapsed;
      this._bounceCount = 0;
    }
  }

  _updateBounce(dt, t) {
    // Small bounces near final position
    const bT = (this._elapsed - this._bounceStart);
    const bounceDur = 0.4;

    // Move toward target angle
    const angleDiff = this._targetAngle - this._orbitAngle;
    this._orbitAngle += angleDiff * dt * 3;
    this._orbitRadius += (0.5 - this._orbitRadius) * dt * 4;

    const bounceHeight = Math.max(0, Math.abs(Math.sin(bT * 12)) * 0.03 * Math.exp(-bT * 4));

    const x = Math.cos(this._orbitAngle) * this._orbitRadius;
    const z = Math.sin(this._orbitAngle) * this._orbitRadius;
    this._ball.position.set(x, 0.08 + bounceHeight, z);
    this._glow.position.copy(this._ball.position);
    this._glow.intensity = 0.4 + bounceHeight * 8;

    if (bT > bounceDur) {
      this._phase = 'settle';
      this._settlePos.copy(this._ball.position);
      this._settlePos.y = 0.08;
      if (this._callback) this._callback();
    }
  }

  _updateSettle(dt) {
    // Gently rest in place
    this._ball.position.lerp(this._settlePos, dt * 8);
    this._glow.intensity *= 0.95;
    if (this._glow.intensity < 0.05) {
      this._glow.intensity = 0;
    }
  }
}
