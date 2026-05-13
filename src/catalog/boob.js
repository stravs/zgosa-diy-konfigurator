import * as THREE from 'three';
import { getQuarterPipeRun } from './quarterPipe.js';
import { materials } from './materials.js';

function transitionHeight(distance, radius) {
  const d = THREE.MathUtils.clamp(distance, 0, radius);
  return radius - Math.sqrt(Math.max(0, (radius * radius) - (d * d)));
}

function getTransitionSlope(distance, radius) {
  return distance / Math.sqrt(Math.max(0.0001, (radius * radius) - (distance * distance)));
}

function getDomeBaseRadius(capHeight, slope) {
  return capHeight * (1 + Math.sqrt(1 + (slope * slope))) / Math.max(slope, 0.0001);
}

function getDomeHeight(ringRadius, baseRadius, baseHeight, capHeight) {
  const sphereRadius = ((baseRadius * baseRadius) + (capHeight * capHeight)) / (2 * capHeight);
  const sphereCenterY = baseHeight + capHeight - sphereRadius;
  return sphereCenterY + Math.sqrt(Math.max(0, (sphereRadius * sphereRadius) - (ringRadius * ringRadius)));
}

export function createBoob(object) {
  const { height } = object.params;
  const radius = object.params.radius ?? 2;
  const domeEdgeHeight = height * 0.78;
  const capHeight = Math.max(0.05, height - domeEdgeHeight);
  const safeRadius = Math.max(radius, domeEdgeHeight + 0.01);
  const run = getQuarterPipeRun(domeEdgeHeight, safeRadius);
  const transitionSlope = getTransitionSlope(run, safeRadius);
  const domeBaseRadius = getDomeBaseRadius(capHeight, transitionSlope);
  const totalRadius = run + domeBaseRadius;
  const radialSegments = 40;
  const angleSegments = 80;

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

  for (let a = 0; a <= angleSegments; a += 1) {
    const theta = (a / angleSegments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    for (let r = 0; r <= radialSegments; r += 1) {
      const t = r / radialSegments;
      const ringRadius = totalRadius * (1 - t);
      let y;

      if (ringRadius >= domeBaseRadius) {
        const transitionDistance = totalRadius - ringRadius;
        y = transitionHeight(transitionDistance, safeRadius);
      } else {
        y = getDomeHeight(ringRadius, domeBaseRadius, domeEdgeHeight, capHeight);
      }

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

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
