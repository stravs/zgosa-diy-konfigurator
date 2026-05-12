import * as THREE from 'three';
import { materials } from './materials.js';

export function createQuarterPipe(object) {
  const { width, height } = object.params;
  const radius = object.params.radius ?? object.params.depth ?? 2;
  const safeRadius = Math.max(radius, height);
  const run = Math.sqrt((safeRadius * safeRadius) - ((safeRadius - height) * (safeRadius - height)));
  const maxAngle = Math.acos((safeRadius - height) / safeRadius);
  const group = new THREE.Group();

  const shape = new THREE.Shape();
  const segments = 24;

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
  group.add(ramp);

  const deckDepth = object.params.deckDepth ?? 0.8;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, deckDepth),
    materials.rampSurface
  );
  deck.position.set(0, height / 2, -run / 2 - deckDepth / 2);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  return group;
}
