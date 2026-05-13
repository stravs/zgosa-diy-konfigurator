import * as THREE from 'three';
import { getQuarterPipeRun } from './quarterPipe.js';
import { materials } from './materials.js';
import { getCurveSegments } from '../core/performance.js';

function transitionHeight(distance, radius, run) {
  const d = THREE.MathUtils.clamp(distance, 0, run);
  return radius - Math.sqrt(Math.max(0, (radius * radius) - (d * d)));
}

export function createVolcanoMesh(params) {
  const { height } = params;
  const radius = params.radius ?? 2;
  const topRadius = params.topRadius ?? 0.6;
  const degrees = params.degrees ?? 360;
  const sweepAngle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(degrees, 1, 360));
  const isFullCircle = Math.abs(degrees - 360) < 0.0001;
  const safeRadius = Math.max(radius, height);
  const run = getQuarterPipeRun(height, safeRadius);
  const radialSegments = getCurveSegments(24, 10);
  const maxAngleSegments = getCurveSegments(64, 28);
  const angleSegments = isFullCircle ? maxAngleSegments : Math.max(2, Math.ceil(maxAngleSegments * (degrees / 360)));

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

  // Sweep quarter-pipe transition around a circle or partial arc.
  // Outer edge is flat at ground. Inner edge is top radius / apex.
  for (let a = 0; a <= angleSegments; a += 1) {
    const theta = (a / angleSegments) * sweepAngle;
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
  const addVertex = (x, y, z) => {
    vertices.push(x, y, z);
    return (vertices.length / 3) - 1;
  };

  for (let a = 0; a < angleSegments; a += 1) {
    for (let r = 0; r < radialSegments; r += 1) {
      const first = a * rowSize + r;
      const second = first + rowSize;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  // Flat circular top surface for true volcano.
  if (topRadius > 0) {
    const centerIndex = addVertex(0, height, 0);

    for (let a = 0; a < angleSegments; a += 1) {
      const topA = (a * rowSize) + radialSegments;
      const topB = ((a + 1) * rowSize) + radialSegments;
      indices.push(centerIndex, topA, topB);
    }
  }

  // Close side skins for partial sweeps.
  if (!isFullCircle) {
    for (const a of [0, angleSegments]) {
      for (let r = 0; r < radialSegments; r += 1) {
        const topA = (a * rowSize) + r;
        const topB = (a * rowSize) + r + 1;
        const ax = vertices[topA * 3];
        const az = vertices[topA * 3 + 2];
        const bx = vertices[topB * 3];
        const bz = vertices[topB * 3 + 2];
        const bottomA = addVertex(ax, 0, az);
        const bottomB = addVertex(bx, 0, bz);

        indices.push(bottomA, topA, bottomB);
        indices.push(topA, topB, bottomB);
      }
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

export function createVolcano(object) {
  return createVolcanoMesh(object.params);
}
