import * as THREE from 'three';
import { Materials } from '../utils/Materials.js';
import { createWoodTexture } from '../utils/ProceduralTextures.js';

/**
 * Physical arcade/casino machine cabinet — lever + coin tray.
 * No buttons. One lever to rule them all.
 */
export class ArcadeMachine {
  constructor() {
    this.group = new THREE.Group();

    this._interactables = [];
    this._leverAngle = 0;
    this._leverPulling = false;
    this._leverPhase = 'pull';
    this._leverCallback = null;

    this._buildCabinet();
    this._buildScreen();
    this._buildLever();
    this._buildCoinTray();
    this._buildHeader();
  }

  // ── Cabinet body ──
  _buildCabinet() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.4, metalness: 0.7 });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.6), metalMat);
    body.position.y = 0.8;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.7), metalMat);
    base.position.y = 0.05;
    base.castShadow = true;
    this.group.add(base);

    // Top cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.55), metalMat);
    cap.position.y = 1.64;
    this.group.add(cap);

    // Gold trim strips
    const trimMat = Materials.gold();
    const addTrim = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      m.position.set(x, y, z);
      this.group.add(m);
    };
    addTrim(1.02, 0.02, 0.62, 0, 1.6, 0);
    addTrim(1.02, 0.02, 0.62, 0, 0.10, 0);
    addTrim(0.02, 1.5, 0.02, -0.51, 0.85, 0.3);
    addTrim(0.02, 1.5, 0.02, 0.51, 0.85, 0.3);
  }

  // ── CRT Screen ──
  _buildScreen() {
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.8, metalness: 0.3 });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.72, 0.04), bezelMat);
    bezel.position.set(0, 1.22, 0.29);
    this.group.add(bezel);

    const screenGeo = new THREE.PlaneGeometry(0.76, 0.66);
    this.screenMesh = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.screenMesh.position.set(0, 1.22, 0.315);
    this.group.add(this.screenMesh);

    // Screen glow
    this._screenGlow = new THREE.PointLight(0x33ff66, 1.5, 2);
    this._screenGlow.position.set(0, 1.22, 0.5);
    this.group.add(this._screenGlow);
  }

  setScreenMaterial(mat) {
    this.screenMesh.material = mat;
  }

  // ── Lever ──
  _buildLever() {
    const leverGroup = new THREE.Group();
    leverGroup.position.set(0.6, 1.0, 0.2);
    this.group.add(leverGroup);
    this._leverGroup = leverGroup;

    const baseMat = Materials.chrome();
    const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 12), baseMat);
    leverGroup.add(lbase);

    this._leverPivot = new THREE.Group();
    leverGroup.add(this._leverPivot);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), baseMat);
    shaft.position.y = 0.2;
    this._leverPivot.add(shaft);

    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xcc2233, roughness: 0.3, metalness: 0.6,
      emissive: 0x661122, emissiveIntensity: 0.4,
    });
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), handleMat);
    handle.position.y = 0.38;
    this._leverPivot.add(handle);

    // Hit zone (invisible box for raycast)
    const hitZone = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.45, 0.12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitZone.position.y = 0.2;
    hitZone.userData = { action: 'lever', type: 'lever' };
    this._leverPivot.add(hitZone);
    this._interactables.push(hitZone);
  }

  // ── Coin Tray (where coins cascade into) ──
  _buildCoinTray() {
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.6, metalness: 0.5 });

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.4), trayMat);
    floor.position.set(0, 0.12, 0.6);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.02), trayMat);
    back.position.set(0, 0.2, 0.42);
    this.group.add(back);

    // Left
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.4), trayMat);
    left.position.set(-0.4, 0.2, 0.6);
    this.group.add(left);

    // Right
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.4), trayMat);
    right.position.set(0.4, 0.2, 0.6);
    this.group.add(right);

    // Front lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.02), trayMat);
    lip.position.set(0, 0.16, 0.8);
    this.group.add(lip);

    // Gold rim on front lip
    const rimMat = Materials.gold();
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.02, 0.02), rimMat);
    rim.position.set(0, 0.205, 0.8);
    this.group.add(rim);
  }

  // ── Coin Slot (aesthetic + clickable to start) ──
  _buildCoinSlot() {
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.5, metalness: 0.6 });

    // Slot surround
    const surround = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), slotMat);
    surround.position.set(-0.35, 0.85, 0.31);
    this.group.add(surround);

    // Actual slot (gold slit)
    const slitMat = Materials.gold();
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.005, 0.035), slitMat);
    slit.position.set(-0.35, 0.85, 0.325);
    slit.userData = { action: 'coin_slot', type: 'slot' };
    this.group.add(slit);
    this._interactables.push(slit);

    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, 64, 32);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4a520';
    ctx.fillText('INSERT', 32, 12);
    ctx.fillText('COIN', 32, 24);
    const tex = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), labelMat);
    label.position.set(-0.35, 0.9, 0.315);
    this.group.add(label);
  }

  // ── Header / sign ──
  _buildHeader() {
    const signMat = new THREE.MeshStandardMaterial({ color: 0x0a0812, roughness: 0.8, metalness: 0.3 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.04), signMat);
    sign.position.set(0, 1.78, 0.15);
    this.group.add(sign);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0812';
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = 'bold 64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e0a830';
    ctx.shadowColor = '#e0a830';
    ctx.shadowBlur = 20;
    ctx.fillText('SPINFORGE', 256, 64);
    ctx.shadowBlur = 40;
    ctx.fillText('SPINFORGE', 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.18), textMat);
    textPlane.position.set(0, 1.78, 0.172);
    this.group.add(textPlane);

    const neon = new THREE.PointLight(0xe0a830, 2, 3);
    neon.position.set(0, 1.85, 0.4);
    this.group.add(neon);
  }

  // ── Dispenser opening (where coins come out) ──
  // Coins spawn from physics at this position

  // ── Public API ──

  getInteractables() {
    return this._interactables;
  }

  pullLever() {
    if (this._leverPulling) return Promise.resolve();
    this._leverPulling = true;
    return new Promise(resolve => {
      this._leverCallback = resolve;
    });
  }

  update(dt) {
    // Lever animation — pulls DOWN (Z rotation, classic slot machine)
    if (this._leverPulling) {
      if (this._leverPhase === 'pull') {
        this._leverAngle += dt * 9;
        if (this._leverAngle >= Math.PI * 0.4) {
          this._leverAngle = Math.PI * 0.4;
          this._leverPhase = 'return';
        }
      } else {
        this._leverAngle -= dt * 5;
        if (this._leverAngle <= 0) {
          this._leverAngle = 0;
          this._leverPulling = false;
          this._leverPhase = 'pull';
          if (this._leverCallback) {
            this._leverCallback();
            this._leverCallback = null;
          }
        }
      }
      this._leverPivot.rotation.z = -this._leverAngle;
    }

    // Screen glow pulse
    const t = performance.now() / 1000;
    this._screenGlow.intensity = 1.2 + Math.sin(t * 2) * 0.3;
  }
}
