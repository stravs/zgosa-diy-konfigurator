import { createObjectMesh } from '../catalog/index.js';
import { state } from '../state/store.js';

export function createObjectRenderer(objectLayer) {
  const objectMeshes = new Map();

  function render() {
    objectLayer.clear();
    objectMeshes.clear();

    for (const object of state.objects) {
      const mesh = createObjectMesh(object);
      objectLayer.add(mesh);
      objectMeshes.set(object.id, mesh);
    }
  }

  return {
    objectMeshes,
    render,
  };
}
