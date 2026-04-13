import * as THREE from 'three';
import { createFeltTexture, createWoodTexture } from '../utils/ProceduralTextures.js';

/**
 * Common materials for the casino scene.
 */
export const Materials = {
  felt: () => new THREE.MeshStandardMaterial({
    map: createFeltTexture(),
    roughness: 0.9,
    metalness: 0,
  }),

  wood: () => new THREE.MeshStandardMaterial({
    map: createWoodTexture(),
    roughness: 0.7,
    metalness: 0.1,
  }),

  gold: () => new THREE.MeshStandardMaterial({
    color: 0xd4a520,
    roughness: 0.3,
    metalness: 0.9,
    emissive: 0x201000,
  }),

  chrome: () => new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.15,
    metalness: 1.0,
  }),

  neonPurple: () => new THREE.MeshBasicMaterial({
    color: 0xb040ff,
    transparent: true,
    opacity: 0.9,
  }),

  neonGold: () => new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.9,
  }),

  glass: () => new THREE.MeshPhysicalMaterial({
    color: 0x222244,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.9,
    thickness: 0.5,
    transparent: true,
    opacity: 0.3,
  }),
};
