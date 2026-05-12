import * as THREE from 'three';
import { materials } from './materials.js';

export function createBank(object) {
  const width = object.params.width ?? 2.4;
  const { height, length } = object.params;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
  });

  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, length / 2);

  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
