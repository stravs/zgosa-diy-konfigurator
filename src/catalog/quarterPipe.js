import * as THREE from 'three';
import { materials } from './materials.js';

export function createQuarterPipe(object) {
  const { width, height, depth } = object.params;
  const group = new THREE.Group();

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(depth, 0);

  const segments = 16;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = t * Math.PI * 0.5;
    const x = depth - Math.cos(angle) * depth;
    const y = Math.sin(angle) * height;
    shape.lineTo(x, y);
  }

  shape.lineTo(0, 0);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
  });

  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, depth / 2);

  const ramp = new THREE.Mesh(geometry, materials.rampSurface);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  group.add(ramp);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.12, 0.5),
    materials.side
  );
  deck.position.set(0, height + 0.06, -depth / 2 + 0.25);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const coping = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, width, 24),
    materials.metal
  );
  coping.rotation.z = Math.PI / 2;
  coping.position.set(0, height + 0.04, -depth / 2 + 0.02);
  coping.castShadow = true;
  group.add(coping);

  return group;
}
