import * as THREE from 'three';
import { getQuarterPipeRun } from './quarterPipe.js';
import { materials } from './materials.js';

function transitionHeight(distance, radius, run) {
  const d = THREE.MathUtils.clamp(distance, 0, run);
  return radius - Math.sqrt(Math.max(0, (radius * radius) - (d * d)));
}

export function createVolcano(object) {
  const { height } = object.params;
  const radius = object.params.radius ?? 2;
  const topRadius = object.params.topRadius ?? 0.6;
  const safeRadius = Math.max(radius, height);
  const run = getQuarterPipeRun(height, safeRadius);
  const radialSegments = 24;
  const angleSegments = 64;

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

  // Sweep quarter-pipe transition around a full circle.
  // Outer edge is flat at ground. Inner top is circular deck/lip.
  for (let a = 0; a <= angleSegments; a += 1) {
    const theta = (a / angleSegments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    for (let r = 0; r <= radialSegments; r += 1) {
      const t = r / radialSegments;
      const transitionDistance = t * run;
      const ringRadius = topRadius + run - transitionDistance;
      const y = transitionHeight(transitionDistance, safeRadius, run);

      vertices.push(ringRadius * cosTheta, y, ringRadius * sinTheta);
    }
  }

  const rowSize = radialSegments + 1;

  for (let a = 0; a < angleSegments; a += 1) {
    for (let r = 0; r < radialSegments; r += 1) {
      const first = a * rowSize + r;
      const second = first + rowSize;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  // Flat circular top surface.
  if (topRadius > 0) {
    const centerIndex = vertices.length / 3;
    vertices.push(0, height, 0);

    for (let a = 0; a < angleSegments; a += 1) {
      const topA = (a * rowSize) + radialSegments;
      const topB = ((a + 1) * rowSize) + radialSegments;
      indices.push(centerIndex, topA, topB);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
