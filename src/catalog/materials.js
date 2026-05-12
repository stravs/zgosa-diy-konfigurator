import * as THREE from 'three';

export const materials = {
  rampSurface: new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8, side: THREE.DoubleSide }),
  side: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.35, roughness: 0.35 }),
};
