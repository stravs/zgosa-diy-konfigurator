export const state = {
  version: 1,
  scene: {
    gridSize: 0.01,
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

export function serializeState() {
  return JSON.stringify(state, null, 2);
}

export function loadState(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.objects)) {
    throw new Error('Invalid scene JSON');
  }

  state.version = Number(snapshot.version) || 1;
  state.scene = {
    gridSize: Number(snapshot.scene?.gridSize) || 0.01,
    units: snapshot.scene?.units || 'm',
  };
  state.objects.splice(0, state.objects.length, ...snapshot.objects.map(normalizeObject));
  nextObjectId = getNextObjectId();
}

export function resetState() {
  state.version = 1;
  state.scene = {
    gridSize: 0.01,
    units: 'm',
  };
  state.objects.splice(0, state.objects.length);
  nextObjectId = 1;
}

function normalizeObject(object) {
  const type = object.type === 'corner90' ? 'corner' : object.type;

  return {
    id: String(object.id || `obj_${nextObjectId++}`),
    type,
    position: {
      x: Number(object.position?.x) || 0,
      y: Number(object.position?.y) || 0,
      z: Number(object.position?.z) || 0,
    },
    rotation: {
      x: Number(object.rotation?.x) || 0,
      y: Number(object.rotation?.y) || 0,
      z: Number(object.rotation?.z) || 0,
    },
    params: {
      ...getDefaultParams(type),
      ...object.params,
    },
  };
}

function getNextObjectId() {
  const highestId = state.objects.reduce((highest, object) => {
    const match = /^obj_(\d+)$/.exec(object.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return highestId + 1;
}

export function getDefaultParams(type) {
  if (type === 'box') {
    return { width: 2.4, height: 0.45, depth: 1.2 };
  }

  if (type === 'ledge') {
    return { width: 3.0, height: 0.35, depth: 0.6 };
  }

  if (type === 'quarterPipe') {
    return { width: 2.4, height: 1.2, radius: 2.0, deckDepth: 0.8 };
  }

  if (type === 'halfPipe') {
    return { width: 2.4, height: 1.2, radius: 2.0, flatLength: 1.5, deckDepth: 0.8 };
  }

  if (type === 'corner') {
    return { width: 2.4, height: 1.2, radius: 2.0, deckDepth: 0.8, degrees: 90 };
  }

  if (type === 'hip') {
    return { height: 1.2, radius: 2.0, degrees: 90 };
  }

  if (type === 'volcano') {
    return { height: 1.2, radius: 2.0, topRadius: 0.6 };
  }

  if (type === 'bank') {
    return { width: 2.4, height: 0.8, length: 2.4 };
  }

  if (type === 'pyramid') {
    return { height: 0.8, length: 2.0, topSize: 1.2 };
  }

  if (type === 'rail') {
    return { height: 0.7, length: 3.0, railRadius: 0.05 };
  }

  if (type === 'stairs') {
    return { width: 2.4, height: 0.18, stepCount: 5, treadDepth: 0.35 };
  }

  throw new Error(`Unknown object type: ${type}`);
}
