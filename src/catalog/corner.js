import * as THREE from 'three';
import { getQuarterPipeRun } from './quarterPipe.js';
import { materials } from './materials.js';

export function createCorner(object) {
  const { height } = object.params;
  const radius = object.params.radius ?? 2;
  const deckDepth = object.params.deckDepth ?? 0.8;
  const degrees = THREE.MathUtils.clamp(object.params.degrees ?? 90, 1, 180);
  const sweepAngle = THREE.MathUtils.degToRad(degrees);
  const run = getQuarterPipeRun(height, radius);
  const safeRadius = Math.max(radius, height);
  const maxAngle = Math.acos((safeRadius - height) / safeRadius);
  const radialSegments = 24;
  const angleSegments = 24;
  const group = new THREE.Group();

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

  for (let a = 0; a <= angleSegments; a += 1) {
    const theta = (a / angleSegments) * sweepAngle;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    for (let r = 0; r <= radialSegments; r += 1) {
      const t = r / radialSegments;
      const profileAngle = t * maxAngle;
      const distance = Math.sin(profileAngle) * safeRadius;
      const y = safeRadius - (Math.cos(profileAngle) * safeRadius);
      const x = distance * cosTheta;
      const z = distance * sinTheta;

      vertices.push(x, y, z);
    }
  }

  const rowSize = radialSegments + 1;
  const addVertex = (x, y, z) => {
    vertices.push(x, y, z);
    return (vertices.length / 3) - 1;
  };

  // Curved riding surface.
  for (let a = 0; a < angleSegments; a += 1) {
    for (let r = 0; r < radialSegments; r += 1) {
      const first = a * rowSize + r;
      const second = first + rowSize;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  // Bottom sector, so the corner is solid down to ground.
  const bottomRows = [];

  for (let a = 0; a <= angleSegments; a += 1) {
    const theta = (a / angleSegments) * sweepAngle;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const row = [];

    for (let r = 0; r <= radialSegments; r += 1) {
      const distance = (r / radialSegments) * run;
      row.push(addVertex(distance * cosTheta, 0, distance * sinTheta));
    }

    bottomRows.push(row);
  }

  for (let a = 0; a < angleSegments; a += 1) {
    for (let r = 0; r < radialSegments; r += 1) {
      const a0 = bottomRows[a][r];
      const a1 = bottomRows[a][r + 1];
      const b0 = bottomRows[a + 1][r];
      const b1 = bottomRows[a + 1][r + 1];

      indices.push(a0, a1, b0);
      indices.push(a1, b1, b0);
    }
  }

  // Outer vertical wall at top lip.
  for (let a = 0; a < angleSegments; a += 1) {
    const topA = (a * rowSize) + radialSegments;
    const topB = ((a + 1) * rowSize) + radialSegments;
    const bottomA = bottomRows[a][radialSegments];
    const bottomB = bottomRows[a + 1][radialSegments];

    indices.push(bottomA, topA, bottomB);
    indices.push(topA, topB, bottomB);
  }

  // Side caps at both open ends.
  for (const a of [0, angleSegments]) {
    for (let r = 0; r < radialSegments; r += 1) {
      const curveA = (a * rowSize) + r;
      const curveB = (a * rowSize) + r + 1;
      const bottomA = bottomRows[a][r];
      const bottomB = bottomRows[a][r + 1];

      indices.push(bottomA, curveA, bottomB);
      indices.push(curveA, curveB, bottomB);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const bowl = new THREE.Mesh(geometry, materials.rampSurface);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  bowl.position.set(-run / 2, 0, -run / 2);
  group.add(bowl);

  if (deckDepth > 0) {
    const deckGeometry = new THREE.BufferGeometry();
    const deckVertices = [];
    const deckIndices = [];
    const innerRadius = run;
    const outerRadius = run + deckDepth;

    for (let a = 0; a <= angleSegments; a += 1) {
      const theta = (a / angleSegments) * sweepAngle;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      deckVertices.push(innerRadius * cosTheta, 0, innerRadius * sinTheta);
      deckVertices.push(outerRadius * cosTheta, 0, outerRadius * sinTheta);
      deckVertices.push(innerRadius * cosTheta, height, innerRadius * sinTheta);
      deckVertices.push(outerRadius * cosTheta, height, outerRadius * sinTheta);
    }

    for (let a = 0; a < angleSegments; a += 1) {
      const i = a * 4;
      const next = i + 4;

      // top surface
      deckIndices.push(i + 2, next + 2, i + 3);
      deckIndices.push(next + 2, next + 3, i + 3);

      // outer vertical wall
      deckIndices.push(i + 1, i + 3, next + 1);
      deckIndices.push(next + 1, i + 3, next + 3);

      // inner vertical wall against bowl lip
      deckIndices.push(i, next, i + 2);
      deckIndices.push(next, next + 2, i + 2);
    }

    // end caps
    deckIndices.push(0, 1, 2);
    deckIndices.push(1, 3, 2);

    const last = angleSegments * 4;
    deckIndices.push(last, last + 2, last + 1);
    deckIndices.push(last + 1, last + 2, last + 3);

    deckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(deckVertices, 3));
    deckGeometry.setIndex(deckIndices);
    deckGeometry.computeVertexNormals();

    const deck = new THREE.Mesh(deckGeometry, materials.rampSurface);
    deck.position.set(-run / 2, 0, -run / 2);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
  }

  return group;
}
