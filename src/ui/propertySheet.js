import * as THREE from 'three';
import { catalog } from '../catalog/index.js';

function getFields(object) {
  const fields = [
    { label: 'Rotation', prop: 'rotation.y', value: THREE.MathUtils.radToDeg(object.rotation.y), step: 1 },
    { label: object.type === 'stairs' ? 'Stair Height' : 'Height', prop: 'params.height', value: object.params.height, min: 0.01, step: 0.01 },
  ];

  if (['box', 'ledge', 'quarterPipe', 'halfPipe', 'bank', 'stairs'].includes(object.type)) {
    fields.push({ label: 'Width', prop: 'params.width', value: object.params.width, min: 0.1, step: 0.1 });
  }

  if (['box', 'ledge'].includes(object.type)) {
    fields.push({ label: 'Depth', prop: 'params.depth', value: object.params.depth, min: 0.1, step: 0.1 });
  }

  if (['quarterPipe', 'halfPipe', 'corner', 'hip', 'volcano', 'boob'].includes(object.type)) {
    fields.push({ label: 'Radius', prop: 'params.radius', value: object.params.radius ?? 2, min: 0.1, step: 0.1 });
  }

  if (['bank', 'pyramid', 'flatHip', 'rail'].includes(object.type)) {
    fields.push({ label: object.type === 'pyramid' || object.type === 'flatHip' ? 'Bank Length' : 'Length', prop: 'params.length', value: object.params.length, min: 0.1, step: 0.1 });
  }

  if (['quarterPipe', 'halfPipe', 'corner'].includes(object.type)) {
    fields.push({ label: 'Deck Depth', prop: 'params.deckDepth', value: object.params.deckDepth ?? 0.8, min: 0, step: 0.1 });
  }

  if (object.type === 'halfPipe') {
    fields.push({ label: 'Flat Length', prop: 'params.flatLength', value: object.params.flatLength ?? 1.5, min: 0, step: 0.1 });
  }

  if (['corner', 'hip', 'flatHip'].includes(object.type)) {
    fields.push({ label: object.type === 'hip' ? 'Sweep Angle' : 'Degrees', prop: 'params.degrees', value: object.params.degrees ?? 90, min: 1, max: 180, step: 1 });
  }

  if (object.type === 'volcano') {
    fields.push({ label: 'Top Radius', prop: 'params.topRadius', value: object.params.topRadius ?? 0.6, min: 0, step: 0.1 });
  }

  if (object.type === 'pyramid' || object.type === 'flatHip') {
    fields.push({ label: 'Top Size', prop: 'params.topSize', value: object.params.topSize ?? 1.2, min: 0, step: 0.1 });
  }

  if (object.type === 'stairs') {
    fields.push({ label: 'Number of Stairs', prop: 'params.stepCount', value: object.params.stepCount ?? 5, min: 1, step: 1 });
  }

  fields.push(
    { label: 'X', prop: 'position.x', value: object.position.x, step: 0.01 },
    { label: 'Y', prop: 'position.y', value: object.position.y, step: 0.01 },
    { label: 'Z', prop: 'position.z', value: object.position.z, step: 0.01 }
  );

  return fields;
}

function setObjectValue(object, prop, value, snapToGrid) {
  if (prop === 'position.x') object.position.x = snapToGrid(value);
  else if (prop === 'position.y') object.position.y = value;
  else if (prop === 'position.z') object.position.z = snapToGrid(value);
  else if (prop === 'rotation.y') object.rotation.y = THREE.MathUtils.degToRad(value);
  else if (prop === 'params.width') object.params.width = Math.max(0.1, value);
  else if (prop === 'params.height') object.params.height = Math.max(0.01, value);
  else if (prop === 'params.depth') object.params.depth = Math.max(0.1, value);
  else if (prop === 'params.radius') object.params.radius = Math.max(0.1, value);
  else if (prop === 'params.length') object.params.length = Math.max(0.1, value);
  else if (prop === 'params.deckDepth') object.params.deckDepth = Math.max(0, value);
  else if (prop === 'params.flatLength') object.params.flatLength = Math.max(0, value);
  else if (prop === 'params.degrees') object.params.degrees = THREE.MathUtils.clamp(value, 1, 180);
  else if (prop === 'params.topRadius') object.params.topRadius = Math.max(0, value);
  else if (prop === 'params.topSize') object.params.topSize = Math.max(0, value);
  else if (prop === 'params.stepCount') object.params.stepCount = Math.max(1, Math.round(value));
}

export function createPropertySheet({ getObjectById, snapToGrid, onBeforeChange, onChange, onConfirm, onCancel }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'property-sheet-backdrop';
  backdrop.hidden = true;

  const sheet = document.createElement('section');
  sheet.className = 'property-sheet';
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  let activeObjectId = null;
  let isNewObject = false;
  let didRecord = false;

  function close(confirm = true) {
    if (!activeObjectId) {
      return;
    }

    const objectId = activeObjectId;
    const wasNew = isNewObject;
    activeObjectId = null;
    isNewObject = false;
    didRecord = false;
    backdrop.hidden = true;
    sheet.replaceChildren();

    if (confirm) {
      onConfirm?.(objectId, { wasNew });
    } else {
      onCancel?.(objectId, { wasNew });
    }
  }

  function applyInput(input) {
    const object = getObjectById(activeObjectId);
    const value = Number(input.value);

    if (!object || !Number.isFinite(value)) {
      return;
    }

    if (!didRecord) {
      onBeforeChange?.();
      didRecord = true;
    }

    setObjectValue(object, input.dataset.prop, value, snapToGrid);
    onChange?.(object);
  }

  function open(objectId, options = {}) {
    const object = getObjectById(objectId);

    if (!object) {
      return;
    }

    activeObjectId = objectId;
    isNewObject = Boolean(options.isNew);
    didRecord = Boolean(options.isNew);
    sheet.replaceChildren();

    const title = document.createElement('h2');
    title.textContent = catalog[object.type]?.label ?? object.type;
    sheet.appendChild(title);

    const fields = document.createElement('div');
    fields.className = 'property-sheet-fields';

    for (const field of getFields(object)) {
      const label = document.createElement('label');
      label.textContent = field.label;

      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.prop = field.prop;
      input.step = String(field.step ?? 0.1);
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      input.value = Number(field.value ?? 0).toFixed(field.step === 1 ? 0 : 2);
      input.addEventListener('change', () => applyInput(input));

      label.appendChild(input);
      fields.appendChild(label);
    }

    sheet.appendChild(fields);

    const actions = document.createElement('div');
    actions.className = 'property-sheet-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'secondary';
    cancelButton.textContent = options.isNew ? 'Cancel' : 'Close';
    cancelButton.addEventListener('click', () => close(!options.isNew));

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.textContent = 'Confirm';
    confirmButton.addEventListener('click', () => close(true));

    actions.append(cancelButton, confirmButton);
    sheet.appendChild(actions);

    backdrop.hidden = false;
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close(true);
    }
  });

  sheet.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;

    if (target instanceof HTMLInputElement) {
      applyInput(target);
    }

    event.preventDefault();
    close(true);
  });

  return {
    open,
    close,
    isOpen: () => Boolean(activeObjectId),
  };
}
