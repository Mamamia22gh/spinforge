import * as THREE from 'three';

/**
 * Ghostly dealer NPC across the table.
 */
export class DealerGhost {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, -3.5);

    // Body (translucent cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.6, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x6644aa,
      transparent: true,
      opacity: 0.3,
      emissive: 0x4422aa,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });
    this._body = new THREE.Mesh(bodyGeo, bodyMat);
    this._body.position.y = 1.5;
    this.group.add(this._body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
    this._head = new THREE.Mesh(headGeo, bodyMat.clone());
    this._head.position.y = 2.5;
    this.group.add(this._head);

    // Eyes (glowing)
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4488 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 2.52, -0.16);
    this.group.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.08, 2.52, -0.16);
    this.group.add(eyeR);

    // Eye glow
    this._eyeLight = new THREE.PointLight(0xff4488, 1, 3);
    this._eyeLight.position.set(0, 2.52, -0.2);
    this.group.add(this._eyeLight);
  }

  update(dt) {
    const t = performance.now() / 1000;
    // Gentle float
    this._body.position.y = 1.5 + Math.sin(t * 0.8) * 0.05;
    this._head.position.y = 2.5 + Math.sin(t * 0.8) * 0.05;
    // Eye pulse
    this._eyeLight.intensity = 1 + Math.sin(t * 3) * 0.4;
    // Subtle sway
    this.group.rotation.y = Math.sin(t * 0.3) * 0.05;
  }
}
