import * as THREE from 'three';
import { RetroWheel } from './RetroWheel.js';

/**
 * Screen — ONLY the wheel. Nothing else.
 */
export class CRTScreen {
  constructor() {
    this._canvas = document.createElement('canvas');
    this._canvas.width = 512;
    this._canvas.height = 512;
    this._ctx = this._canvas.getContext('2d');
    this._canvasTex = new THREE.CanvasTexture(this._canvas);
    this._canvasTex.minFilter = THREE.LinearFilter;

    this.wheel = new RetroWheel();

    this.material = new THREE.MeshBasicMaterial({
      map: this._canvasTex,
    });
  }

  render(dt) {
    this.wheel.update(dt);

    const ctx = this._ctx;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, 512, 512);

    this.wheel.draw(ctx, 256, 256, this.wheel.RADIUS);

    this._canvasTex.needsUpdate = true;
  }

  shopReset() {}
}
