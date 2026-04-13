import * as THREE from 'three';
import { Materials } from '../utils/Materials.js';
import { createFeltTexture, createWoodTexture } from '../utils/ProceduralTextures.js';

/**
 * Atmospheric casino room surrounding the machine.
 */
export class ArcadeRoom {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildFloor();
    this._buildWalls();
    this._buildNeonStrips();
    this._buildLighting(scene);
    scene.fog = new THREE.FogExp2(0x06050c, 0.06);
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(20, 20);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.92, metalness: 0.05 });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Carpet circle around machine
    const carpetGeo = new THREE.CircleGeometry(2.5, 48);
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x1a0828, roughness: 0.95 });
    const carpet = new THREE.Mesh(carpetGeo, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.002;
    carpet.receiveShadow = true;
    this.group.add(carpet);
  }

  _buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e0c18, roughness: 0.9, metalness: 0.05 });
    const wallGeo = new THREE.PlaneGeometry(20, 5);

    const back = new THREE.Mesh(wallGeo, wallMat);
    back.position.set(0, 2.5, -10);
    this.group.add(back);

    const left = new THREE.Mesh(wallGeo, wallMat);
    left.position.set(-10, 2.5, 0);
    left.rotation.y = Math.PI / 2;
    this.group.add(left);

    const right = new THREE.Mesh(wallGeo, wallMat);
    right.position.set(10, 2.5, 0);
    right.rotation.y = -Math.PI / 2;
    this.group.add(right);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x050408, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 5;
    this.group.add(ceil);
  }

  _buildNeonStrips() {
    const addStrip = (color, pos, scale) => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.scale.set(...scale);
      this.group.add(mesh);
      const light = new THREE.PointLight(color, 3, 8);
      light.position.set(...pos);
      this.group.add(light);
    };

    addStrip(0xb040ff, [0, 3.5, -9.9], [6, 0.08, 0.08]);
    addStrip(0xffaa00, [0, 2.2, -9.9], [4, 0.05, 0.05]);
    addStrip(0xb040ff, [-9.9, 3.5, 0], [0.08, 0.08, 6]);
    addStrip(0xffaa00, [9.9, 2.2, 0], [0.05, 0.05, 4]);
  }

  _buildLighting(scene) {
    scene.add(new THREE.AmbientLight(0x665577, 4.0));

    // Spot on machine
    this._spot = new THREE.SpotLight(0xffe0b0, 25, 20, Math.PI / 3, 0.3, 0.6);
    this._spot.position.set(0, 4.5, 2);
    this._spot.target.position.set(0, 1.0, 0);
    this._spot.castShadow = true;
    this._spot.shadow.mapSize.set(1024, 1024);
    scene.add(this._spot);
    scene.add(this._spot.target);

    // Purple accent
    this._purple = new THREE.PointLight(0x8833cc, 8, 20);
    this._purple.position.set(-3, 3, -3);
    scene.add(this._purple);

    // Gold accent
    this._gold = new THREE.PointLight(0xe0a030, 7, 20);
    this._gold.position.set(3, 3, 2);
    scene.add(this._gold);

    // Fill light from behind player
    const fill = new THREE.PointLight(0x667799, 5, 25);
    fill.position.set(0, 3, 6);
    scene.add(fill);

    // Extra fill from sides
    const fillL = new THREE.PointLight(0x556688, 3, 18);
    fillL.position.set(-5, 2, 2);
    scene.add(fillL);
    const fillR = new THREE.PointLight(0x556688, 3, 18);
    fillR.position.set(5, 2, 2);
    scene.add(fillR);
  }

  update(dt) {
    const t = performance.now() / 1000;
    this._purple.intensity = 4 + Math.sin(t * 1.8) * 0.6;
    this._gold.intensity = 3 + Math.sin(t * 1.3 + 1) * 0.4;
  }
}
