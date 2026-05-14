export const state = {
  version: 1,
  scene: {
    gridSize: 0.01,
    units: 'm',
  },
  objects: [],
  groups: [],
};

const MAX_OBJECTS = 1000;
const MAX_GROUPS = 300;
const MAX_IDS_PER_GROUP = 300;
const MAX_ABS_POSITION = 10000;
const MAX_ABS_ROTATION = Math.PI * 8;
const MAX_PARAM_VALUE = 10000;
const MAX_ID_LENGTH = 80;
const MAX_NAME_LENGTH = 80;
const ALLOWED_TYPES = new Set([
  'box',
  'ledge',
  'quarterPipe',
  'halfPipe',
  'corner',
  'hip',
  'volcano',
  'bank',
  'pyramid',
  'flatHip',
  'rail',
  'stairs',
  'skater',
  'boob',
]);

let nextObjectId = 1;
let nextGroupId = 1;

export function addObject(type, position = { x: 0, y: 0, z: 0 }) {
  const object = {
    id: `obj_${nextObjectId++}`,
    type,
    position: { x: position.x, y: position.y ?? 0, z: position.z },
    rotation: { x: 0, y: 0, z: 0 },
    params: getDefaultParams(type),
    locked: false,
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

  for (const group of state.groups) {
    group.objectIds = group.objectIds.filter((objectId) => objectId !== id);
  }

  state.groups = state.groups.filter((group) => group.objectIds.length > 0);
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

export function createGroup(objectIds, name = null) {
  const uniqueObjectIds = [...new Set(objectIds)].filter((id) => getObjectById(id));

  if (uniqueObjectIds.length < 2) {
    return null;
  }

  const group = {
    id: `group_${nextGroupId++}`,
    name: name ?? `Group ${nextGroupId - 1}`,
    objectIds: uniqueObjectIds,
    locked: false,
  };

  state.groups.push(group);
  return group;
}

export function getGroupById(id) {
  return state.groups.find((group) => group.id === id) ?? null;
}

export function removeGroup(id) {
  const index = state.groups.findIndex((group) => group.id === id);

  if (index === -1) {
    return null;
  }

  const [removedGroup] = state.groups.splice(index, 1);
  return removedGroup;
}

export function renameGroup(id, name) {
  const group = getGroupById(id);
  const trimmedName = String(name || '').trim();

  if (!group || !trimmedName) {
    return null;
  }

  group.name = trimmedName;
  return group;
}

export function setObjectLocked(id, locked) {
  const object = getObjectById(id);

  if (!object) {
    return null;
  }

  object.locked = Boolean(locked);
  return object;
}

export function setGroupLocked(id, locked) {
  const group = getGroupById(id);

  if (!group) {
    return null;
  }

  group.locked = Boolean(locked);
  return group;
}

function roundForSave(value) {
  if (typeof value === 'number') {
    return Math.round(value * 100) / 100;
  }

  if (Array.isArray(value)) {
    return value.map(roundForSave);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, roundForSave(entryValue)])
    );
  }

  return value;
}

export function serializeState() {
  return JSON.stringify(roundForSave(state));
}

export function loadState(snapshot) {
  if (!isPlainObject(snapshot) || !Array.isArray(snapshot.objects)) {
    throw new Error('Invalid scene JSON');
  }

  if (snapshot.objects.length > MAX_OBJECTS) {
    throw new Error(`Too many objects. Max ${MAX_OBJECTS}.`);
  }

  if (snapshot.groups && (!Array.isArray(snapshot.groups) || snapshot.groups.length > MAX_GROUPS)) {
    throw new Error(`Too many groups. Max ${MAX_GROUPS}.`);
  }

  state.version = sanitizeInteger(snapshot.version, 1, 1, 999);
  state.scene = {
    gridSize: sanitizeNumber(snapshot.scene?.gridSize, 0.01, 0.01, 100),
    units: sanitizeText(snapshot.scene?.units, 'm', 12),
  };
  state.objects.splice(0, state.objects.length, ...snapshot.objects.map(normalizeObject));
  state.groups.splice(0, state.groups.length, ...(snapshot.groups ?? []).map(normalizeGroup).filter(Boolean));
  nextObjectId = getNextObjectId();
  nextGroupId = getNextGroupId();
}

export function resetState() {
  state.version = 1;
  state.scene = {
    gridSize: 0.01,
    units: 'm',
  };
  state.objects.splice(0, state.objects.length);
  state.groups.splice(0, state.groups.length);
  nextObjectId = 1;
  nextGroupId = 1;
}

function normalizeObject(object) {
  if (!isPlainObject(object)) {
    throw new Error('Invalid object in scene JSON');
  }

  const type = object.type === 'corner90' ? 'corner' : String(object.type || '');

  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`Unknown object type: ${type || 'missing'}`);
  }

  return {
    id: sanitizeId(object.id, `obj_${nextObjectId++}`),
    type,
    position: {
      x: sanitizeNumber(object.position?.x, 0, -MAX_ABS_POSITION, MAX_ABS_POSITION),
      y: sanitizeNumber(object.position?.y, 0, -MAX_ABS_POSITION, MAX_ABS_POSITION),
      z: sanitizeNumber(object.position?.z, 0, -MAX_ABS_POSITION, MAX_ABS_POSITION),
    },
    rotation: {
      x: sanitizeNumber(object.rotation?.x, 0, -MAX_ABS_ROTATION, MAX_ABS_ROTATION),
      y: sanitizeNumber(object.rotation?.y, 0, -MAX_ABS_ROTATION, MAX_ABS_ROTATION),
      z: sanitizeNumber(object.rotation?.z, 0, -MAX_ABS_ROTATION, MAX_ABS_ROTATION),
    },
    params: sanitizeParams(type, object.params),
    locked: Boolean(object.locked),
  };
}

function normalizeGroup(group) {
  if (!isPlainObject(group)) {
    return null;
  }

  const objectIds = Array.isArray(group.objectIds)
    ? [...new Set(group.objectIds.slice(0, MAX_IDS_PER_GROUP).map((id) => sanitizeId(id, '')))].filter((id) => id && getObjectById(id))
    : [];

  if (objectIds.length === 0) {
    return null;
  }

  return {
    id: sanitizeId(group.id, `group_${nextGroupId++}`),
    name: sanitizeText(group.name || group.id, `Group ${nextGroupId}`, MAX_NAME_LENGTH),
    objectIds,
    locked: Boolean(group.locked),
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeNumber(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function sanitizeInteger(value, fallback, min, max) {
  return Math.round(sanitizeNumber(value, fallback, min, max));
}

function sanitizeText(value, fallback, maxLength) {
  const text = String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (text || fallback).slice(0, maxLength);
}

function sanitizeId(value, fallback) {
  const id = sanitizeText(value, fallback, MAX_ID_LENGTH).replace(/[^a-zA-Z0-9_-]/g, '_');
  return id || fallback;
}

function sanitizeParams(type, params) {
  const defaults = getDefaultParams(type);
  const sanitized = { ...defaults };

  if (!isPlainObject(params)) {
    return sanitized;
  }

  for (const key of Object.keys(defaults)) {
    if (!(key in params)) {
      continue;
    }

    if (key === 'stepCount') {
      sanitized[key] = sanitizeInteger(params[key], defaults[key], 1, 100);
    } else if (key === 'degrees') {
      sanitized[key] = sanitizeNumber(params[key], defaults[key], 1, 360);
    } else {
      sanitized[key] = sanitizeNumber(params[key], defaults[key], 0, MAX_PARAM_VALUE);
    }
  }

  return sanitized;
}

function getNextObjectId() {
  const highestId = state.objects.reduce((highest, object) => {
    const match = /^obj_(\d+)$/.exec(object.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return highestId + 1;
}

function getNextGroupId() {
  const highestId = state.groups.reduce((highest, group) => {
    const match = /^group_(\d+)$/.exec(group.id);
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

  if (type === 'flatHip') {
    return { height: 0.8, length: 2.0, topSize: 0, degrees: 90 };
  }

  if (type === 'rail') {
    return { height: 0.7, length: 3.0, railRadius: 0.05 };
  }

  if (type === 'stairs') {
    return { width: 2.4, height: 0.18, stepCount: 5, treadDepth: 0.35 };
  }

  if (type === 'skater') {
    return { height: 1.8 };
  }

  if (type === 'boob') {
    return { height: 0.8, radius: 1.8 };
  }

  throw new Error(`Unknown object type: ${type}`);
}
