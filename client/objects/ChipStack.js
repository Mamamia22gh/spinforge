import * as THREE from 'three';

const CHIP_COLORS = {
  5: 0xcc3333,   // red
  10: 0x3344cc,  // blue
  25: 0x22aa44,  // green
  50: 0xd4a520,  // gold
  100: 0x222222, // black
};

/**
 * Procedural 3D poker chip stack.
 */
export class ChipStack {
  constructor(value = 10, count = 5) {
    this.group = new THREE.Group();
    this._chips = [];
    this.setValue(value, count);
  }

  setValue(value, count) {
    // Clear
    for (const c of this._chips) {
      this.group.remove(c);
      c.geometry.dispose();
      c.material.dispose();
    }
    this._chips = [];

    const color = CHIP_COLORS[value] ?? 0x888888;
    const chipGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);

    for (let i = 0; i < Math.min(count, 20); i++) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.3,
        emissive: color,
        emissiveIntensity: 0.1,
      });
      const chip = new THREE.Mesh(chipGeo, mat);
      chip.position.y = i * 0.035;
      chip.castShadow = true;
      this.group.add(chip);
      this._chips.push(chip);
    }
  }

  update(dt) {
    // Subtle bob
    const t = performance.now() / 1000;
    this.group.position.y += Math.sin(t * 1.5) * 0.0002;
  }
}
