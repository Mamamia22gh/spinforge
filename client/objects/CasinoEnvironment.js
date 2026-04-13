import * as THREE from 'three';
import { Materials } from '../utils/Materials.js';
import { createFeltTexture, createWoodTexture } from '../utils/ProceduralTextures.js';

/**
 * The roulette table and casino room environment.
 */
export class CasinoEnvironment {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildTable();
    this._buildRoom();
    this._buildLighting(scene);
    this._buildFog(scene);
  }

  _buildTable() {
    // Table top (oval)
    const tableGeo = new THREE.CylinderGeometry(2.0, 2.0, 0.12, 32);
    const tableMat = new THREE.MeshStandardMaterial({
      map: createFeltTexture(512),
      roughness: 0.85,
      metalness: 0,
    });
    this._table = new THREE.Mesh(tableGeo, tableMat);
    this._table.position.y = 0.9;
    this._table.receiveShadow = true;
    this._table.castShadow = true;
    this.group.add(this._table);

    // Table rim (gold)
    const rimGeo = new THREE.TorusGeometry(2.0, 0.06, 8, 48);
    const rimMat = Materials.gold();
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.96;
    rim.castShadow = true;
    this.group.add(rim);

    // Table legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.9, 8);
    const legMat = new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.7, metalness: 0.1 });
    const legPositions = [
      [-1.2, 0.45, -1.2], [1.2, 0.45, -1.2],
      [-1.2, 0.45, 1.2], [1.2, 0.45, 1.2],
    ];
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.group.add(leg);
    }
  }

  _buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      roughness: 0.95,
      metalness: 0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls (dark)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f0f1a,
      roughness: 0.9,
      metalness: 0.05,
    });

    const wallGeo = new THREE.PlaneGeometry(30, 8);
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 4, -15);
    this.group.add(backWall);

    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-15, 4, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(15, 4, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.group.add(rightWall);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(30, 30);
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 1 });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 8;
    this.group.add(ceil);

    // Neon strips
    this._buildNeonStrip(0xb040ff, [0, 3.5, -14.8], [8, 0.08, 0.08]);
    this._buildNeonStrip(0xffaa00, [0, 2.0, -14.8], [6, 0.06, 0.06]);
    this._buildNeonStrip(0xb040ff, [-14.8, 3.5, 0], [0.08, 0.08, 8], Math.PI / 2);
    this._buildNeonStrip(0xffaa00, [14.8, 2.0, 0], [0.06, 0.06, 6], Math.PI / 2);
  }

  _buildNeonStrip(color, position, scale) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    this.group.add(mesh);

    // Glow light
    const light = new THREE.PointLight(color, 2, 8);
    light.position.set(...position);
    this.group.add(light);
  }

  _buildLighting(scene) {
    // Ambient
    this._ambient = new THREE.AmbientLight(0x2a2040, 1.2);
    scene.add(this._ambient);

    // Main spotlight on table
    this._mainLight = new THREE.SpotLight(0xffe8c0, 15, 16, Math.PI / 3, 0.4, 0.8);
    this._mainLight.position.set(0, 6, 0);
    this._mainLight.target.position.set(0, 0.9, 0);
    this._mainLight.castShadow = true;
    this._mainLight.shadow.mapSize.set(1024, 1024);
    scene.add(this._mainLight);
    scene.add(this._mainLight.target);

    // Accent purple
    this._purpleLight = new THREE.PointLight(0x8833cc, 5, 15);
    this._purpleLight.position.set(-4, 4, -4);
    scene.add(this._purpleLight);

    // Accent gold
    this._goldLight = new THREE.PointLight(0xe0a030, 4, 15);
    this._goldLight.position.set(4, 4, 4);
    scene.add(this._goldLight);
  }

  _buildFog(scene) {
    scene.fog = new THREE.FogExp2(0x08060e, 0.02);
  }

  update(dt) {
    // Subtle light flicker
    const t = performance.now() / 1000;
    this._purpleLight.intensity = 3 + Math.sin(t * 2.1) * 0.5;
    this._goldLight.intensity = 2 + Math.sin(t * 1.7 + 1) * 0.3;
  }
}
