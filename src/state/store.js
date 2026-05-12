export const state = {
  version: 1,
  scene: {
    gridSize: 1,
    units: 'm',
  },
  objects: [],
};

let nextObjectId = 1;

export function addObject(type, position = { x: 0, y: 0, z: 0 }) {
  const object = {
    id: `obj_${nextObjectId++}`,
    type,
    position: { x: position.x, y: position.y ?? 0, z: position.z },
    rotation: { x: 0, y: 0, z: 0 },
    params: getDefaultParams(type),
  };

  state.objects.push(object);
  return object;
}

export function getObjectById(id) {
  return state.objects.find((object) => object.id === id) ?? null;
}

export function removeObject(id) {
  const index = state.objects.findIndex((object) => object.id === id);

  if (index === -1) {
    return null;
  }

  const [removedObject] = state.objects.splice(index, 1);
  return removedObject;
}

export function duplicateObject(id, offset = { x: 1, z: 1 }) {
  const source = getObjectById(id);

  if (!source) {
    return null;
  }

  const copy = structuredClone(source);
  copy.id = `obj_${nextObjectId++}`;
  copy.position.x += offset.x;
  copy.position.z += offset.z;

  state.objects.push(copy);
  return copy;
}

function getDefaultParams(type) {
  if (type === 'box') {
    return { width: 2.4, height: 0.45, depth: 1.2 };
  }

  if (type === 'ledge') {
    return { width: 3.0, height: 0.35, depth: 0.6 };
  }

  if (type === 'quarterPipe') {
    return { width: 2.4, height: 1.2, depth: 2.0 };
  }

  throw new Error(`Unknown object type: ${type}`);
}
