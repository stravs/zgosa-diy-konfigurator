import * as THREE from 'three';
import { materials } from './materials.js';

export function createRail(object) {
  const length = object.params.length ?? 3;
  const height = object.params.height ?? 0.7;
  const railRadius = object.params.railRadius ?? 0.05;
  const supportRadius = 0.035;
  const group = new THREE.Group();

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(railRadius, railRadius, length, 24),
    materials.metal
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.y = height;
  rail.castShadow = true;
  rail.receiveShadow = true;
  group.add(rail);

  const supportCount = 3;

  for (let i = 0; i < supportCount; i += 1) {
    const t = supportCount === 1 ? 0.5 : i / (supportCount - 1);
    const x = -length / 2 + t * length;

    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(supportRadius, supportRadius, height, 16),
      materials.metal
    );
    support.position.set(x, height / 2, 0);
    support.castShadow = true;
    support.receiveShadow = true;
    group.add(support);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.035, 0.18),
      materials.metal
    );
    foot.position.set(x, 0.0175, 0);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
  }

  return group;
}
