import * as THREE from 'three';
import { ArcadeMachine } from '../objects/ArcadeMachine.js';
import { ArcadeRoom } from '../objects/ArcadeRoom.js';
import { CRTScreen } from '../objects/CRTScreen.js';
import { CoinPhysics } from '../physics/CoinPhysics.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';

/**
 * Main scene — casino room with arcade machine, coin physics, particles.
 * Camera is fixed facing the machine; interaction via raycasting.
 */
export class ArcadeScene {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06050c);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 50);
    this.camera.position.set(0, 1.35, 1.8);
    this.camera.lookAt(0, 1.1, 0);

    this.room = new ArcadeRoom(this.scene);
    this.machine = new ArcadeMachine();
    this.scene.add(this.machine.group);

    this.crt = new CRTScreen();
    this.machine.setScreenMaterial(this.crt.material);

    // ── Cinema screen behind machine (mirrors the CRT) ──
    this._buildCinemaScreen();

    this.coins = new CoinPhysics(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.raycaster = new THREE.Raycaster();

    this._initPromise = this.coins.init();
  }

  _buildCinemaScreen() {
    // Large screen on back wall
    const screenW = 4.0;
    const screenH = 3.2;

    // Bezel / frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.3, metalness: 0.8 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(screenW + 0.3, screenH + 0.3, 0.1), frameMat);
    frame.position.set(0, 2.8, -9.85);
    this.scene.add(frame);

    // Gold trim
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4a520, roughness: 0.3, metalness: 0.9, emissive: 0x201000 });
    const trimGeo = new THREE.BoxGeometry(screenW + 0.35, screenH + 0.35, 0.05);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, 2.8, -9.82);
    this.scene.add(trim);

    // Screen surface — shares the CRT canvas texture
    const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.crt._canvasTex,
    });
    this._cinemaScreen = new THREE.Mesh(screenGeo, screenMat);
    this._cinemaScreen.position.set(0, 2.8, -9.78);
    this.scene.add(this._cinemaScreen);

    // Screen glow
    const glow = new THREE.PointLight(0x33ff66, 3, 6);
    glow.position.set(0, 2.8, -9);
    this.scene.add(glow);
    this._cinemaGlow = glow;
  }

  /** Wait for physics to be ready. */
  async waitReady() {
    await this._initPromise;
  }

  update(dt, gameState) {
    this.room.update(dt);
    this.machine.update(dt);
    this.crt.render(dt);
    this.coins.update(dt);
    this.particles.update(dt);
  }

  /**
   * Raycast from screen coords, return the first interactable hit.
   * @returns {{ action: string, type: string }|null}
   */
  getInteractableAt(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const mesh of this.machine.getInteractables()) {
      const hits = this.raycaster.intersectObject(mesh, true);
      if (hits.length > 0) return mesh.userData;
    }
    return null;
  }

  triggerWin(coinCount) {
    this.coins.dropCoins(coinCount);
    this.particles.sparkle(new THREE.Vector3(0, 1.4, 0.4), 0xffcc00, 30);
  }

  triggerFever() {
    this.particles.feverBurst(new THREE.Vector3(0, 1.4, 0.4));
  }
}
