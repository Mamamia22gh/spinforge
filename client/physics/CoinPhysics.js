import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const COIN_RADIUS = 0.022;
const COIN_HALF_HEIGHT = 0.003;
const MAX_COINS = 120;
const COIN_LIFETIME = 10;

/**
 * Rapier-powered coin physics — coins cascade out of the machine on wins,
 * bounce on the tray, and pile up satisfyingly.
 */
export class CoinPhysics {
  constructor(scene) {
    this._scene = scene;
    this._world = null;
    this._coins = [];
    this._ready = false;
    this._accumulator = 0;
    this._coinGeo = null;
    this._coinMats = [];
  }

  async init() {
    await RAPIER.init();
    this._world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this._ready = true;

    // Shared geometry
    this._coinGeo = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_HALF_HEIGHT * 2, 12);

    // A few gold variants for visual variety
    const golds = [0xd4a520, 0xc4952a, 0xe0b830, 0xb89020];
    for (const c of golds) {
      this._coinMats.push(new THREE.MeshStandardMaterial({
        color: c, roughness: 0.3, metalness: 0.9,
        emissive: c, emissiveIntensity: 0.08,
      }));
    }

    this._createTray();
  }

  _createTray() {
    // ── Tray floor ──
    const floorDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.12, 0.6);
    const floorBody = this._world.createRigidBody(floorDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.015, 0.2).setRestitution(0.25).setFriction(0.7),
      floorBody,
    );

    // ── Tray back wall ──
    const backDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.2, 0.42);
    const backBody = this._world.createRigidBody(backDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.1, 0.01).setRestitution(0.2).setFriction(0.5),
      backBody,
    );

    // ── Tray left wall ──
    const leftDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(-0.4, 0.2, 0.6);
    const leftBody = this._world.createRigidBody(leftDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.01, 0.1, 0.2).setRestitution(0.2).setFriction(0.5),
      leftBody,
    );

    // ── Tray right wall ──
    const rightDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0.4, 0.2, 0.6);
    const rightBody = this._world.createRigidBody(rightDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.01, 0.1, 0.2).setRestitution(0.2).setFriction(0.5),
      rightBody,
    );

    // ── Tray front lip ──
    const frontDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.16, 0.8);
    const frontBody = this._world.createRigidBody(frontDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.05, 0.01).setRestitution(0.2).setFriction(0.5),
      frontBody,
    );

    // ── Machine front face (so coins don't go through) ──
    const machineDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.8, 0.32);
    const machineBody = this._world.createRigidBody(machineDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 0.8, 0.02).setRestitution(0.3).setFriction(0.3),
      machineBody,
    );

    // ── Floor (catch-all) ──
    const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0);
    const groundBody = this._world.createRigidBody(groundDesc);
    this._world.createCollider(
      RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setRestitution(0.15).setFriction(0.8),
      groundBody,
    );
  }

  /**
   * Spawn coins cascading from the machine's dispenser.
   * @param {number} count — number of coins
   */
  dropCoins(count) {
    if (!this._ready) return;

    const n = Math.min(count, MAX_COINS - this._coins.length);
    for (let i = 0; i < n; i++) {
      setTimeout(() => this._spawnCoin(), i * 50 + Math.random() * 30);
    }
  }

  _spawnCoin() {
    if (!this._ready || this._coins.length >= MAX_COINS) return;

    // Spawn from dispenser slot (above tray, in the machine face)
    const x = (Math.random() - 0.5) * 0.25;
    const y = 0.55 + Math.random() * 0.15;
    const z = 0.36;

    const mat = this._coinMats[Math.floor(Math.random() * this._coinMats.length)];
    const mesh = new THREE.Mesh(this._coinGeo, mat);
    mesh.castShadow = true;
    this._scene.add(mesh);

    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinvel(
        (Math.random() - 0.5) * 0.8,
        -0.5 - Math.random() * 1.5,
        1.5 + Math.random() * 1.5,
      )
      .setAngvel(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
      );
    const body = this._world.createRigidBody(desc);

    const collider = RAPIER.ColliderDesc.cylinder(COIN_HALF_HEIGHT, COIN_RADIUS)
      .setRestitution(0.35)
      .setFriction(0.6)
      .setDensity(8.0);
    this._world.createCollider(collider, body);

    this._coins.push({ body, mesh, age: 0 });
  }

  update(dt) {
    if (!this._ready || !this._world) return;

    // Fixed timestep physics
    this._accumulator += dt;
    while (this._accumulator >= 1 / 60) {
      this._world.step();
      this._accumulator -= 1 / 60;
    }

    // Sync Three.js meshes
    for (let i = this._coins.length - 1; i >= 0; i--) {
      const coin = this._coins[i];
      coin.age += dt;

      const pos = coin.body.translation();
      const rot = coin.body.rotation();

      coin.mesh.position.set(pos.x, pos.y, pos.z);
      coin.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

      // Fade out old coins
      if (coin.age > COIN_LIFETIME - 1) {
        const alpha = Math.max(0, COIN_LIFETIME - coin.age);
        coin.mesh.material.opacity = alpha;
        coin.mesh.material.transparent = true;
      }

      // Remove dead coins
      if (coin.age > COIN_LIFETIME || pos.y < -3) {
        this._scene.remove(coin.mesh);
        this._world.removeRigidBody(coin.body);
        this._coins.splice(i, 1);
      }
    }
  }

  clear() {
    for (const coin of this._coins) {
      this._scene.remove(coin.mesh);
      this._world.removeRigidBody(coin.body);
    }
    this._coins = [];
  }

  get ready() { return this._ready; }
  get coinCount() { return this._coins.length; }
}
