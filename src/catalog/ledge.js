import * as THREE from 'three';
import { materials } from './materials.js';

export function createLedge(object) {
  const { width, height, depth } = object.params;
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.rampSurface);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const coping = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.06, 0.08), materials.metal);
  coping.position.set(0, height + 0.03, -depth / 2 + 0.04);
  coping.castShadow = true;
  group.add(coping);

  return group;
}
