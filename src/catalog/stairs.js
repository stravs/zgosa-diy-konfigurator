import * as THREE from 'three';
import { materials } from './materials.js';

export function createStairs(object) {
  const width = object.params.width ?? 2.4;
  const stepHeight = object.params.height ?? 0.18;
  const stepCount = Math.max(1, Math.round(object.params.stepCount ?? 5));
  const treadDepth = object.params.treadDepth ?? 0.35;
  const totalDepth = stepCount * treadDepth;
  const group = new THREE.Group();

  for (let i = 0; i < stepCount; i += 1) {
    const stairHeight = stepHeight * (i + 1);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(width, stairHeight, treadDepth),
      materials.rampSurface
    );

    step.position.set(
      0,
      stairHeight / 2,
      -totalDepth / 2 + (i * treadDepth) + treadDepth / 2
    );
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  return group;
}
