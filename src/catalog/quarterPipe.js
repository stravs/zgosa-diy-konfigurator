import * as THREE from 'three';
import { materials } from './materials.js';
import { getCurveSegments } from '../core/performance.js';

export function getQuarterPipeRun(height, radius) {
  const safeRadius = Math.max(radius, height);
  return Math.sqrt((safeRadius * safeRadius) - ((safeRadius - height) * (safeRadius - height)));
}

export function createQuarterPipeMesh(params) {
  const { width, height } = params;
  const radius = params.radius ?? params.depth ?? 2;
  const safeRadius = Math.max(radius, height);
  const run = getQuarterPipeRun(height, safeRadius);
  const maxAngle = Math.acos((safeRadius - height) / safeRadius);
  const shape = new THREE.Shape();
  const segments = getCurveSegments(24, 10);

  // Solid quarter pipe profile.
  // Editable values: width, height, radius.
  // Riding face is circular and concave.
  shape.moveTo(0, 0);
  shape.lineTo(run, 0);
  shape.lineTo(run, height);

  for (let i = segments; i >= 0; i -= 1) {
    const t = i / segments;
    const angle = t * maxAngle;
    const x = Math.sin(angle) * safeRadius;
    const y = safeRadius - (Math.cos(angle) * safeRadius);
    shape.lineTo(x, y);
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
  });

  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, run / 2);

  const ramp = new THREE.Mesh(geometry, materials.rampSurface);
  ramp.castShadow = true;
  ramp.receiveShadow = true;

  return ramp;
}

export function createDeckMesh(params) {
  const { width, height } = params;
  const deckDepth = params.deckDepth ?? 0.8;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, deckDepth),
    materials.rampSurface
  );
  deck.castShadow = true;
  deck.receiveShadow = true;

  return deck;
}

export function createQuarterPipe(object) {
  const { height } = object.params;
  const radius = object.params.radius ?? object.params.depth ?? 2;
  const run = getQuarterPipeRun(height, radius);
  const deckDepth = object.params.deckDepth ?? 0.8;
  const group = new THREE.Group();

  group.add(createQuarterPipeMesh(object.params));

  if (deckDepth > 0) {
    const deck = createDeckMesh(object.params);
    deck.position.set(0, height / 2, -run / 2 - deckDepth / 2);
    group.add(deck);
  }

  return group;
}
