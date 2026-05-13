import { createBox } from './box.js';
import { createLedge } from './ledge.js';
import { createQuarterPipe } from './quarterPipe.js';
import { createHalfPipe } from './halfPipe.js';
import { createCorner } from './corner.js';
import { createHip } from './hip.js';
import { createVolcano } from './volcano.js';
import { createBank } from './bank.js';
import { createPyramid } from './pyramid.js';
import { createRail } from './rail.js';
import { createStairs } from './stairs.js';
import { createSkater } from './skater.js';
import { createBoob } from './boob.js';

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
  halfPipe: {
    label: 'Half Pipe',
    createMesh: createHalfPipe,
  },
  corner: {
    label: 'Corner',
    createMesh: createCorner,
  },
  corner90: {
    label: 'Corner',
    createMesh: createCorner,
  },
  hip: {
    label: 'Hip',
    createMesh: createHip,
  },
  volcano: {
    label: 'Volcano',
    createMesh: createVolcano,
  },
  bank: {
    label: 'Bank',
    createMesh: createBank,
  },
  pyramid: {
    label: 'Pyramid',
    createMesh: createPyramid,
  },
  rail: {
    label: 'Rail',
    createMesh: createRail,
  },
  stairs: {
    label: 'Stairs',
    createMesh: createStairs,
  },
  skater: {
    label: 'Skater',
    createMesh: createSkater,
  },
  boob: {
    label: 'Boob',
    createMesh: createBoob,
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
