import { createBox } from './box.js';
import { createLedge } from './ledge.js';
import { createQuarterPipe } from './quarterPipe.js';

export const catalog = {
  box: {
    label: 'Box',
    createMesh: createBox,
  },
  ledge: {
    label: 'Ledge',
    createMesh: createLedge,
  },
  quarterPipe: {
    label: 'Quarter Pipe',
    createMesh: createQuarterPipe,
  },
};

export function createObjectMesh(object) {
  const item = catalog[object.type];

  if (!item) {
    throw new Error(`Unknown catalog item: ${object.type}`);
  }

  const mesh = item.createMesh(object);
  mesh.position.set(object.position.x, object.position.y, object.position.z);
  mesh.rotation.set(object.rotation.x, object.rotation.y, object.rotation.z);
  mesh.userData.objectId = object.id;

  mesh.traverse((child) => {
    child.userData.objectId = object.id;
  });

  return mesh;
}
