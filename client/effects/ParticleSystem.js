import * as THREE from 'three';

/**
 * Particle effects — win sparkles, fever flames, etc.
 */
export class ParticleSystem {
  constructor(scene) {
    this._scene = scene;
    this._systems = [];
  }

  /**
   * Burst of sparkles at a position.
   */
  sparkle(position, color = 0xffcc00, count = 30) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 3,
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.08,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    this._scene.add(points);

    this._systems.push({
      points, velocities, geo, mat,
      life: 0, maxLife: 1.5,
    });
  }

  /**
   * Fire burst for fever mode.
   */
  feverBurst(position) {
    this.sparkle(position, 0xff4400, 50);
    this.sparkle(position, 0xffaa00, 30);
  }

  update(dt) {
    for (let i = this._systems.length - 1; i >= 0; i--) {
      const sys = this._systems[i];
      sys.life += dt;

      if (sys.life >= sys.maxLife) {
        this._scene.remove(sys.points);
        sys.geo.dispose();
        sys.mat.dispose();
        this._systems.splice(i, 1);
        continue;
      }

      const positions = sys.geo.attributes.position.array;
      const alpha = 1 - (sys.life / sys.maxLife);
      sys.mat.opacity = alpha;

      for (let j = 0; j < sys.velocities.length; j++) {
        const v = sys.velocities[j];
        v.y -= 5 * dt; // gravity
        positions[j * 3] += v.x * dt;
        positions[j * 3 + 1] += v.y * dt;
        positions[j * 3 + 2] += v.z * dt;
      }

      sys.geo.attributes.position.needsUpdate = true;
    }
  }
}
