import * as THREE from 'three';
import { RouletteWheel } from '../objects/RouletteWheel.js';
import { CasinoEnvironment } from '../objects/CasinoEnvironment.js';
import { ChipStack } from '../objects/ChipStack.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';

/**
 * Main Three.js scene — casino interior with roulette table.
 */
export class CasinoScene {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x08060e);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 3.5, 4.5);
    this.camera.lookAt(0, 1.0, 0);

    // Environment (room, table, lights)
    this.environment = new CasinoEnvironment(this.scene);

    // Roulette wheel
    this.wheel = new RouletteWheel();
    this.scene.add(this.wheel.group);

    // Chip stacks on table
    this.chipStacks = [];
    const stackPositions = [
      [-1.4, 0.97, 0.8],
      [-1.0, 0.97, 1.1],
      [1.4, 0.97, 0.8],
    ];
    for (const [x, y, z] of stackPositions) {
      const stack = new ChipStack(10, 5);
      stack.group.position.set(x, y, z);
      this.scene.add(stack.group);
      this.chipStacks.push(stack);
    }

    // Particles
    this.particles = new ParticleSystem(this.scene);
  }

  update(dt) {
    this.wheel.update(dt);
    this.environment.update(dt);

    this.particles.update(dt);
    for (const stack of this.chipStacks) stack.update(dt);
  }

  updateChips(chips) {
    const count = Math.min(20, Math.ceil(chips / 5));
    if (this.chipStacks[0]) this.chipStacks[0].setValue(10, Math.min(count, 10));
    if (this.chipStacks[1]) this.chipStacks[1].setValue(25, Math.max(0, count - 10));
  }

  triggerWin() {
    this.particles.sparkle(new THREE.Vector3(0, 1.5, 0), 0xffcc00, 40);
  }

  triggerFever() {
    this.particles.feverBurst(new THREE.Vector3(0, 1.5, 0));
  }
}
