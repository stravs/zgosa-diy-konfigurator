import * as THREE from 'three';
import { materials } from './materials.js';

export function createFlatHip(object) {
  const { height } = object.params;
  const length = object.params.length ?? 2;
  const topSize = object.params.topSize ?? 0;
  const degrees = THREE.MathUtils.clamp(object.params.degrees ?? 90, 1, 180);
  const sweepAngle = THREE.MathUtils.degToRad(degrees);
  const halfSweep = sweepAngle / 2;
  const topRadius = Math.max(0, topSize / 2);
  const baseRadius = topRadius + length;
  const thetaA = -halfSweep;
  const thetaB = halfSweep;

  const point = (radius, y, theta) => [
    radius * Math.sin(theta),
    y,
    radius * Math.cos(theta),
  ];

  const vertices = [];
  const indices = [];
  const add = (...coords) => {
    vertices.push(...coords);
    return (vertices.length / 3) - 1;
  };

  const groundCenter = add(0, 0, 0);
  const baseA = add(...point(baseRadius, 0, thetaA));
  const baseB = add(...point(baseRadius, 0, thetaB));

  if (topRadius <= 0.001) {
    const apex = add(0, height, 0);

    // Riding face.
    indices.push(baseA, baseB, apex);

    // Bottom and side caps.
    indices.push(groundCenter, baseA, baseB);
    indices.push(groundCenter, apex, baseA);
    indices.push(groundCenter, baseB, apex);
  } else {
    const topA = add(...point(topRadius, height, thetaA));
    const topB = add(...point(topRadius, height, thetaB));

    // Riding face.
    indices.push(baseA, baseB, topB);
    indices.push(baseA, topB, topA);

    // Top face.
    indices.push(groundCenter, topA, topB);

    // Bottom and side caps.
    indices.push(groundCenter, baseA, baseB);
    indices.push(groundCenter, topA, baseA);
    indices.push(groundCenter, baseB, topB);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
