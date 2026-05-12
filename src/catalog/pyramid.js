import * as THREE from 'three';
import { materials } from './materials.js';

export function createPyramid(object) {
  const { height } = object.params;
  const bankLength = object.params.length ?? 2.0;
  const topSize = object.params.topSize ?? 1.2;
  const halfTop = topSize / 2;
  const halfBase = halfTop + bankLength;

  const vertices = [
    // top square
    -halfTop, height, -halfTop,
    halfTop, height, -halfTop,
    halfTop, height, halfTop,
    -halfTop, height, halfTop,

    // base square
    -halfBase, 0, -halfBase,
    halfBase, 0, -halfBase,
    halfBase, 0, halfBase,
    -halfBase, 0, halfBase,
  ];

  const indices = [
    // top
    0, 1, 2,
    0, 2, 3,

    // front bank
    4, 5, 1,
    4, 1, 0,

    // right bank
    5, 6, 2,
    5, 2, 1,

    // back bank
    6, 7, 3,
    6, 3, 2,

    // left bank
    7, 4, 0,
    7, 0, 3,
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
