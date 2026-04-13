import * as THREE from 'three';

/**
 * Orthographic HUD rendered on top of the 3D scene.
 * Uses canvas-based sprites for text overlays.
 */
export class HUD {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, 0.1, 100);
    this.camera.position.z = 10;

    this._canvas = document.createElement('canvas');
    this._canvas.width = 1920;
    this._canvas.height = 1080;
    this._ctx = this._canvas.getContext('2d');

    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.minFilter = THREE.LinearFilter;

    const plane = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
    const mat = new THREE.MeshBasicMaterial({ map: this._texture, transparent: true, depthTest: false });
    this._quad = new THREE.Mesh(plane, mat);
    this._quad.position.set(window.innerWidth / 2, window.innerHeight / 2, 0);
    this.scene.add(this._quad);

    this._data = {};
    this._messages = [];
  }

  setData(data) {
    this._data = data;
  }

  showMessage(text, duration = 2) {
    this._messages.push({ text, remaining: duration });
  }

  render(dt) {
    const ctx = this._ctx;
    const W = 1920, H = 1080;
    ctx.clearRect(0, 0, W, H);

    const d = this._data;

    // Top-left: Round + Quota
    ctx.font = 'bold 36px serif';
    ctx.fillStyle = '#e0c080';
    ctx.textAlign = 'left';
    ctx.fillText(`Round ${d.round ?? 1} / 12`, 30, 50);

    ctx.font = '28px serif';
    ctx.fillStyle = '#ccaa66';
    ctx.fillText(`Quota: ${d.quota ?? '—'}`, 30, 90);

    // Top-right: Chips + Score
    ctx.textAlign = 'right';
    ctx.font = 'bold 36px serif';
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(`🪙 ${d.chips ?? 0}`, W - 30, 50);

    ctx.font = '28px serif';
    ctx.fillStyle = '#88ff88';
    ctx.fillText(`💵 ${d.currency ?? 0}`, W - 30, 90);

    ctx.fillStyle = '#bbbbdd';
    ctx.fillText(`Score: ${d.score ?? 0}`, W - 30, 130);

    // Bottom: Spins left
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px serif';
    ctx.fillStyle = '#ccccee';
    ctx.fillText(`Spins: ${d.spinsLeft ?? 0}`, W / 2, H - 40);

    // Phase indicator
    if (d.phase) {
      ctx.font = '24px serif';
      ctx.fillStyle = '#9988bb';
      ctx.fillText(d.phase, W / 2, H - 80);
    }

    // Fever indicator
    if (d.fever) {
      ctx.font = 'bold 40px serif';
      ctx.fillStyle = '#ff6600';
      ctx.fillText('🔥 FEVER 🔥', W / 2, 160);
    }

    // Active bets
    if (d.bets && d.bets.length > 0) {
      ctx.textAlign = 'left';
      ctx.font = '22px serif';
      ctx.fillStyle = '#bbaacc';
      ctx.fillText('Paris actifs:', 30, H - 180);
      d.bets.forEach((b, i) => {
        ctx.fillText(`  ${b.betTypeId} — mise ${b.wager}`, 30, H - 150 + i * 28);
      });
    }

    // Relics
    if (d.relics && d.relics.length > 0) {
      ctx.textAlign = 'left';
      ctx.font = '20px serif';
      ctx.fillStyle = '#aa88dd';
      const relicStr = d.relics.map(r => r.emoji).join(' ');
      ctx.fillText(relicStr, 30, 140);
    }

    // Floating messages
    ctx.textAlign = 'center';
    for (let i = this._messages.length - 1; i >= 0; i--) {
      const msg = this._messages[i];
      msg.remaining -= dt;
      if (msg.remaining <= 0) {
        this._messages.splice(i, 1);
        continue;
      }
      const alpha = Math.min(1, msg.remaining);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 48px serif';
      ctx.fillStyle = '#ffee88';
      ctx.fillText(msg.text, W / 2, 300 + i * 60);
    }
    ctx.globalAlpha = 1;

    this._texture.needsUpdate = true;
  }

  resize(w, h) {
    this.camera.right = w;
    this.camera.top = h;
    this.camera.updateProjectionMatrix();
    this._quad.position.set(w / 2, h / 2, 0);
    this._quad.scale.set(w / this._quad.geometry.parameters.width, h / this._quad.geometry.parameters.height, 1);
  }
}
