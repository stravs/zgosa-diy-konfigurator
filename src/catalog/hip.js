import { createVolcanoMesh } from './volcano.js';

export function createHip(object) {
  return createVolcanoMesh({
    ...object.params,
    topRadius: 0,
    degrees: object.params.degrees ?? 90,
  });
}
