import * as THREE from 'three';
import { getSymbol } from '../../src/data/symbols.js';

const SYMBOL_COLORS = {
  red: 0xcc2233, blue: 0x2244cc, gold: 0xd4a520,
  green: 0x22aa44, purple: 0x8833cc, white: 0xccccee,
  void: 0x220044, wild: 0xff44ff,
};

// Alternating red/black pattern (casino style)
const SLOT_COLORS = [0xcc1122, 0x111111]; // red, black

/**
 * Casino-style 3D roulette wheel — bowl shape, tilted toward player.
 * Red/black numbered pockets, gold frets, wooden rim, gold turret center.
 */
export class RouletteWheel {
  constructor() {
    this.group = new THREE.Group();

    // Tilt ~65° toward player (like wall-mounted casino display)
    this._tiltGroup = new THREE.Group();
    this._tiltGroup.rotation.x = -Math.PI * 0.36; // ~65° tilt
    this.group.add(this._tiltGroup);

    // The spinning disc
    this._disc = new THREE.Group();
    this._tiltGroup.add(this._disc);

    this._segments = [];
    this._pegs = [];
    this._deflectors = [];

    this._buildBowl();
    this._buildTurret();
    this._buildBallTrack();

    // Animation
    this._angle = 0;
    this._spinning = false;
    this._spinStartTime = 0;
    this._spinDuration = 0;
    this._startAngle = 0;
    this._totalSpin = 0;
    this._idleTime = 0;

    // Position: on a table in the room
    this.group.position.set(0, 0.85, 0);
  }

  // ═══ Build static geometry ═══

  _buildBowl() {
    // Outer wooden rim (static, doesn't spin)
    const rimProfile = new THREE.Shape();
    rimProfile.moveTo(1.35, -0.08);
    rimProfile.lineTo(1.5, -0.04);
    rimProfile.lineTo(1.52, 0.06);
    rimProfile.lineTo(1.48, 0.12);
    rimProfile.lineTo(1.35, 0.10);
    rimProfile.lineTo(1.35, -0.08);

    const rimGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(1.35, -0.08),
        new THREE.Vector2(1.5, -0.04),
        new THREE.Vector2(1.52, 0.06),
        new THREE.Vector2(1.48, 0.12),
        new THREE.Vector2(1.35, 0.10),
      ],
      64
    );
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f, roughness: 0.6, metalness: 0.1,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.castShadow = true;
    rim.receiveShadow = true;
    this._tiltGroup.add(rim);

    // Bowl floor (slight concave — flat disc with raised edge)
    const bowlGeo = new THREE.CylinderGeometry(1.36, 1.36, 0.04, 64);
    const bowlMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.85, metalness: 0.05,
    });
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    bowl.position.y = -0.06;
    bowl.receiveShadow = true;
    this._tiltGroup.add(bowl);

    // Diamond deflectors on the rim (gold pins)
    const deflectorGeo = new THREE.OctahedronGeometry(0.035, 0);
    const deflectorMat = new THREE.MeshStandardMaterial({
      color: 0xd4a520, roughness: 0.3, metalness: 0.9,
      emissive: 0x201000,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const d = new THREE.Mesh(deflectorGeo, deflectorMat);
      d.position.set(Math.cos(a) * 1.42, 0.06, Math.sin(a) * 1.42);
      d.rotation.y = a;
      this._tiltGroup.add(d);
      this._deflectors.push(d);
    }
  }

  _buildTurret() {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a520, roughness: 0.25, metalness: 0.9,
      emissive: 0x302000, emissiveIntensity: 0.3,
    });

    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.08, 24), goldMat);
    base.position.y = 0.02;
    this._disc.add(base);

    // Middle tier
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.20, 0.12, 24), goldMat);
    mid.position.y = 0.12;
    this._disc.add(mid);

    // Crown
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), goldMat);
    crown.position.y = 0.24;
    crown.scale.y = 0.7;
    this._disc.add(crown);

    // Top finial
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 8), goldMat);
    finial.position.y = 0.32;
    this._disc.add(finial);
  }

  _buildBallTrack() {
    // Smooth polished track ring (between rim and pockets)
    const trackGeo = new THREE.TorusGeometry(1.32, 0.025, 8, 64);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x5a3825, roughness: 0.3, metalness: 0.2,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = Math.PI / 2;
    track.position.y = 0.04;
    this._tiltGroup.add(track);
  }

  // ═══ Segments (pockets) ═══

  updateWheel(wheelData) {
    // Clear old
    for (const seg of this._segments) {
      this._disc.remove(seg.mesh);
      seg.mesh.geometry.dispose();
      seg.mesh.material.dispose();
    }
    this._segments = [];
    for (const peg of this._pegs) {
      this._disc.remove(peg);
      peg.geometry.dispose();
      peg.material.dispose();
    }
    this._pegs = [];

    const count = wheelData.length;
    const totalWeight = wheelData.reduce((s, w) => s + w.weight, 0);
    let angleOffset = 0;

    const innerR = 0.28;
    const outerR = 1.30;

    for (let idx = 0; idx < count; idx++) {
      const data = wheelData[idx];
      const angle = (data.weight / totalWeight) * Math.PI * 2;

      // Casino red/black alternating, with game color tint
      const symbol = getSymbol(data.symbolId);
      const gameColor = SYMBOL_COLORS[symbol.color] ?? 0x888888;
      const casinoBase = SLOT_COLORS[idx % 2];

      // Blend: 70% casino red/black, 30% game color
      const r1 = (casinoBase >> 16) & 0xff, g1 = (casinoBase >> 8) & 0xff, b1 = casinoBase & 0xff;
      const r2 = (gameColor >> 16) & 0xff, g2 = (gameColor >> 8) & 0xff, b2 = gameColor & 0xff;
      const blend = 0.3;
      const fr = Math.round(r1 * (1 - blend) + r2 * blend);
      const fg = Math.round(g1 * (1 - blend) + g2 * blend);
      const fb = Math.round(b1 * (1 - blend) + b2 * blend);
      const finalColor = (fr << 16) | (fg << 8) | fb;

      // Pocket slice
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const a = angleOffset + (i / steps) * angle;
        shape.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
      }
      shape.lineTo(0, 0);

      // Inner cutout (turret area)
      const hole = new THREE.Path();
      for (let i = 0; i <= steps; i++) {
        const a = angleOffset + (i / steps) * angle;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        hole[method](Math.cos(a) * innerR, Math.sin(a) * innerR);
      }
      // Close the hole back through center-adjacent points
      hole.lineTo(Math.cos(angleOffset) * innerR, Math.sin(angleOffset) * innerR);
      shape.holes.push(hole);

      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      const mat = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.45,
        metalness: 0.15,
        emissive: finalColor,
        emissiveIntensity: 0.08,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -0.02;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this._disc.add(mesh);
      this._segments.push({ mesh, data, angle, offset: angleOffset, color: finalColor });

      // Gold fret (divider) at segment start
      const fretGeo = new THREE.BoxGeometry(0.015, 0.06, outerR - innerR);
      const fretMat = new THREE.MeshStandardMaterial({
        color: 0xd4a520, roughness: 0.3, metalness: 0.85,
        emissive: 0x201000,
      });
      const fret = new THREE.Mesh(fretGeo, fretMat);
      const fretR = (innerR + outerR) / 2;
      const fretAngle = angleOffset;
      fret.position.set(
        Math.cos(fretAngle) * fretR,
        0.01,
        -Math.sin(fretAngle) * fretR,
      );
      fret.rotation.y = fretAngle;
      this._disc.add(fret);
      this._pegs.push(fret);

      angleOffset += angle;
    }
  }

  // ═══ Spin animation ═══

  spinTo(segmentIndex, wheelData) {
    const totalWeight = wheelData.reduce((s, w) => s + w.weight, 0);

    let angleSum = 0;
    for (let i = 0; i < segmentIndex; i++) {
      angleSum += (wheelData[i].weight / totalWeight) * Math.PI * 2;
    }
    angleSum += (wheelData[segmentIndex].weight / totalWeight) * Math.PI;

    const extraRotations = 5 + Math.random() * 3;
    const targetAngle = extraRotations * Math.PI * 2 + (Math.PI * 2 - angleSum);

    this._startAngle = this._angle;
    this._totalSpin = targetAngle;
    this._spinDuration = 3.5 + Math.random() * 1.0;
    this._spinStartTime = performance.now() / 1000;
    this._spinning = true;
  }

  _easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  update(dt) {
    this._idleTime += dt;

    if (this._spinning) {
      const now = performance.now() / 1000;
      const elapsed = now - this._spinStartTime;
      const t = Math.min(1, elapsed / this._spinDuration);

      const eased = this._easeOutQuart(t);
      this._angle = this._startAngle + this._totalSpin * eased;
      this._disc.rotation.y = this._angle;

      if (t >= 1) {
        this._spinning = false;
      }
    } else {
      // Subtle idle rotation
      this._angle += dt * 0.05;
      this._disc.rotation.y = this._angle;
    }
  }

  get isSpinning() { return this._spinning; }
}
