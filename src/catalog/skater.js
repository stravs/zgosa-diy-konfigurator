import * as THREE from 'three';
import { materials } from './materials.js';

const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 0.7 });
const shirtMaterial = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8 });
const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 });
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.5 });

export function createSkater(object) {
  const height = object.params.height ?? 1.8;
  const scale = height / 1.8;
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.9), boardMaterial);
  board.position.set(0, 0.04, 0);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  for (const x of [-0.11, 0.11]) {
    for (const z of [-0.32, 0.32]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.01, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.75, 16), pantsMaterial);
  leftLeg.position.set(-0.09, 0.45, -0.08);
  leftLeg.rotation.x = -0.2;
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.75, 16), pantsMaterial);
  rightLeg.position.set(0.09, 0.45, 0.08);
  rightLeg.rotation.x = 0.2;
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 8, 16), shirtMaterial);
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), skinMaterial);
  head.position.set(0, 1.55, 0);
  head.castShadow = true;
  group.add(head);

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.55, 16), skinMaterial);
  leftArm.position.set(-0.25, 1.1, 0);
  leftArm.rotation.z = -0.45;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.55, 16), skinMaterial);
  rightArm.position.set(0.25, 1.1, 0);
  rightArm.rotation.z = 0.45;
  rightArm.castShadow = true;
  group.add(rightArm);

  return group;
}
