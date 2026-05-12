import * as THREE from 'three';
import { getQuarterPipeRun } from './quarterPipe.js';
import { materials } from './materials.js';

function transitionHeight(distance, radius, run) {
  const d = THREE.MathUtils.clamp(distance, 0, run);
  return radius - Math.sqrt(Math.max(0, (radius * radius) - (d * d)));
}

function smoothMin(a, b, softness) {
  const s = Math.max(softness, 0.0001);
  return ((a + b) - Math.sqrt(((a - b) * (a - b)) + (s * s)) + s) / 2;
}

function blendedHipHeight(h1, h2, softness) {
  // Keep the bottom edges exactly flat.
  // Soft blends can lift a zero-height edge slightly, which looks wrong.
  if (h1 <= 0.0001 || h2 <= 0.0001) {
    return 0;
  }

  return smoothMin(h1, h2, softness);
}

export function createHip(object) {
  const { height } = object.params;
  const radius = object.params.radius ?? 2;
  const degrees = THREE.MathUtils.clamp(object.params.degrees ?? 90, 1, 180);
  const sweepAngle = THREE.MathUtils.degToRad(degrees);
  const safeRadius = Math.max(radius, height);
  const run = getQuarterPipeRun(height, safeRadius);
  const blendSoftness = height * 0.12;
  const segments = 32;

  const n1 = new THREE.Vector2(1, 0);
  const n2 = new THREE.Vector2(Math.cos(-sweepAngle), Math.sin(-sweepAngle));

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

  // Hip as smooth intersection of two quarter-pipe transition height fields.
  // u and v are distances up each transition face.
  for (let i = 0; i <= segments; i += 1) {
    const u = (i / segments) * run;

    for (let j = 0; j <= segments; j += 1) {
      const v = (j / segments) * run;
      const p = n1.clone().multiplyScalar(u).add(n2.clone().multiplyScalar(v));
      const h1 = transitionHeight(u, safeRadius, run);
      const h2 = transitionHeight(v, safeRadius, run);
      const y = blendedHipHeight(h1, h2, blendSoftness);

      vertices.push(p.x, y, p.y);
    }
  }

  const rowSize = segments + 1;
  const addVertex = (x, y, z) => {
    vertices.push(x, y, z);
    return (vertices.length / 3) - 1;
  };

  // Main blended riding surface.
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * rowSize + j;
      const b = (i + 1) * rowSize + j;
      const c = i * rowSize + j + 1;
      const d = (i + 1) * rowSize + j + 1;

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Thin side skins, so it does not look like only a loose surface.
  const capEdges = [
    Array.from({ length: rowSize }, (_, j) => j),
    Array.from({ length: rowSize }, (_, j) => (segments * rowSize) + j),
    Array.from({ length: rowSize }, (_, i) => i * rowSize),
    Array.from({ length: rowSize }, (_, i) => (i * rowSize) + segments),
  ];

  for (const edge of capEdges) {
    for (let k = 0; k < edge.length - 1; k += 1) {
      const topA = edge[k];
      const topB = edge[k + 1];
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

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.rampSurface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
