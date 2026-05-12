import * as THREE from 'three';
import { materials } from './materials.js';

export function createBox(object) {
  const { width, height, depth } = object.params;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
