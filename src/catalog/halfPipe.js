import * as THREE from 'three';
import { materials } from './materials.js';
import { createDeckMesh, createQuarterPipeMesh, getQuarterPipeRun } from './quarterPipe.js';

export function createHalfPipe(object) {
  const { width, height } = object.params;
  const radius = object.params.radius ?? 2;
  const flatLength = object.params.flatLength ?? 1.5;
  const run = getQuarterPipeRun(height, radius);
  const group = new THREE.Group();

  const leftQuarter = createQuarterPipeMesh({ width, height, radius });
  leftQuarter.position.z = -flatLength / 2 - run / 2;
  group.add(leftQuarter);

  const rightQuarter = createQuarterPipeMesh({ width, height, radius });
  rightQuarter.rotation.y = Math.PI;
  rightQuarter.position.z = flatLength / 2 + run / 2;
  group.add(rightQuarter);

  const flat = new THREE.Mesh(
    new THREE.PlaneGeometry(width, flatLength),
    materials.rampSurface
  );
  flat.rotation.x = -Math.PI / 2;
  flat.position.set(0, 0.001, 0);
  flat.castShadow = true;
  flat.receiveShadow = true;
  group.add(flat);

  const deckDepth = object.params.deckDepth ?? 0.8;

  if (deckDepth > 0) {
    const leftDeck = createDeckMesh({ width, height, deckDepth });
    leftDeck.position.set(0, height / 2, -flatLength / 2 - run - deckDepth / 2);
    group.add(leftDeck);

    const rightDeck = createDeckMesh({ width, height, deckDepth });
    rightDeck.position.set(0, height / 2, flatLength / 2 + run + deckDepth / 2);
    group.add(rightDeck);
  }

  // Center whole half pipe around object origin.
  group.position.z = 0;

  return group;
}
