import * as THREE from 'three';

export const materials = {
  rampSurface: new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.78, side: THREE.DoubleSide }),
  side: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa8b3c2, metalness: 0.35, roughness: 0.35 }),
  edge: new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.42 }),
};
