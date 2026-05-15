import * as THREE from 'three';
import { catalog } from '../catalog/index.js';

function getFieldGroups(object) {
  const params = [
    { label: object.type === 'stairs' ? 'Stair Height' : 'Height', prop: 'params.height', value: object.params.height, min: 0.01, step: 0.01 },
  ];

  if (['box', 'ledge', 'quarterPipe', 'halfPipe', 'bank', 'stairs'].includes(object.type)) {
    params.push({ label: 'Width', prop: 'params.width', value: object.params.width, min: 0.1, step: 0.1 });
  }

  if (['box', 'ledge'].includes(object.type)) {
    params.push({ label: 'Depth', prop: 'params.depth', value: object.params.depth, min: 0.1, step: 0.1 });
  }

  if (['quarterPipe', 'halfPipe', 'corner', 'hip', 'volcano', 'boob'].includes(object.type)) {
    params.push({ label: 'Radius', prop: 'params.radius', value: object.params.radius ?? 2, min: 0.1, step: 0.1 });
  }

  if (['bank', 'pyramid', 'flatHip', 'rail'].includes(object.type)) {
    params.push({ label: object.type === 'pyramid' || object.type === 'flatHip' ? 'Bank Length' : 'Length', prop: 'params.length', value: object.params.length, min: 0.1, step: 0.1 });
  }

  if (['quarterPipe', 'halfPipe', 'corner'].includes(object.type)) {
    params.push({ label: 'Deck Depth', prop: 'params.deckDepth', value: object.params.deckDepth ?? 0.8, min: 0, step: 0.1 });
  }

  if (object.type === 'halfPipe') {
    params.push({ label: 'Flat Length', prop: 'params.flatLength', value: object.params.flatLength ?? 1.5, min: 0, step: 0.1 });
  }

  if (['corner', 'hip', 'flatHip'].includes(object.type)) {
    params.push({ label: object.type === 'hip' ? 'Sweep Angle' : 'Degrees', prop: 'params.degrees', value: object.params.degrees ?? 90, min: 1, max: 180, step: 1 });
  }

  if (object.type === 'volcano') {
    params.push({ label: 'Top Radius', prop: 'params.topRadius', value: object.params.topRadius ?? 0.6, min: 0, step: 0.1 });
  }

  if (object.type === 'pyramid' || object.type === 'flatHip') {
    params.push({ label: 'Top Size', prop: 'params.topSize', value: object.params.topSize ?? 1.2, min: 0, step: 0.1 });
  }

  if (object.type === 'stairs') {
    params.push({ label: 'Number of Stairs', prop: 'params.stepCount', value: object.params.stepCount ?? 5, min: 1, step: 1 });
  }

  return [
    { title: 'Object params', fields: params.filter((field) => field.value !== undefined) },
    { title: 'Position', fields: [
      { label: 'X', prop: 'position.x', value: object.position.x, step: 0.01 },
      { label: 'Y', prop: 'position.y', value: object.position.y, step: 0.01 },
      { label: 'Z', prop: 'position.z', value: object.position.z, step: 0.01 },
    ] },
    { title: 'Rotation', fields: [
      { label: 'X', prop: 'rotation.x', value: THREE.MathUtils.radToDeg(object.rotation.x), step: 1 },
      { label: 'Y', prop: 'rotation.y', value: THREE.MathUtils.radToDeg(object.rotation.y), step: 1 },
      { label: 'Z', prop: 'rotation.z', value: THREE.MathUtils.radToDeg(object.rotation.z), step: 1 },
    ] },
  ];
}

function setObjectValue(object, prop, value, snapToGrid) {
  if (prop === 'position.x') object.position.x = snapToGrid(value);
  else if (prop === 'position.y') object.position.y = value;
  else if (prop === 'position.z') object.position.z = snapToGrid(value);
  else if (prop === 'rotation.x') object.rotation.x = THREE.MathUtils.degToRad(value);
  else if (prop === 'rotation.y') object.rotation.y = THREE.MathUtils.degToRad(value);
  else if (prop === 'rotation.z') object.rotation.z = THREE.MathUtils.degToRad(value);
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
  let swipeStart = null;
  let swipeLatest = null;
  let swipeMode = null;
  let currentPage = 0;
  let pageSections = [];
  let pageIndicator = null;

  function updateKeyboardOffset() {
    const viewport = window.visualViewport;

    if (!viewport || backdrop.hidden) {
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
      document.body.classList.remove('keyboard-open');
      return;
    }

    const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(offset)}px`);
    document.body.classList.toggle('keyboard-open', offset > 80);
  }

  window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
  window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);

  function close(confirm = true) {
    if (!activeObjectId) {
      return;
    }

    const objectId = activeObjectId;
    const wasNew = isNewObject;
    activeObjectId = null;
    isNewObject = false;
    didRecord = false;
    document.documentElement.style.setProperty('--keyboard-offset', '0px');
    document.body.classList.remove('keyboard-open');
    backdrop.classList.remove('open');
    window.setTimeout(() => {
      if (!activeObjectId) {
        backdrop.hidden = true;
        sheet.replaceChildren();
      }
    }, 180);

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

  function showPage(index) {
    if (pageSections.length === 0) {
      return;
    }

    currentPage = Math.max(0, Math.min(pageSections.length - 1, index));

    pageSections.forEach((section, sectionIndex) => {
      section.hidden = sectionIndex !== currentPage;
    });

    if (pageIndicator) {
      pageIndicator.textContent = `${currentPage + 1} / ${pageSections.length}`;
    }
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
    currentPage = 0;
    pageSections = [];

    const header = document.createElement('div');
    header.className = 'property-sheet-header';

    const title = document.createElement('h2');
    title.textContent = catalog[object.type]?.label ?? object.type;

    pageIndicator = document.createElement('span');
    pageIndicator.className = 'property-sheet-page';

    header.append(title, pageIndicator);
    sheet.appendChild(header);

    const pages = document.createElement('div');
    pages.className = 'property-sheet-pages';
    sheet.appendChild(pages);

    for (const group of getFieldGroups(object)) {
      const section = document.createElement('section');
      section.className = 'property-sheet-section';

      const heading = document.createElement('h3');
      heading.textContent = group.title;
      section.appendChild(heading);

      const fields = document.createElement('div');
      fields.className = 'property-sheet-fields';

      for (const field of group.fields) {
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
        input.addEventListener('focus', () => {
          document.body.classList.add('keyboard-open');
          window.setTimeout(() => {
            updateKeyboardOffset();
            input.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 250);
        });
        input.addEventListener('blur', () => {
          window.setTimeout(updateKeyboardOffset, 120);
        });

        label.appendChild(input);
        fields.appendChild(label);
      }

      section.appendChild(fields);
      pages.appendChild(section);
      pageSections.push(section);
    }

    showPage(0);

    backdrop.classList.remove('open');
    backdrop.hidden = false;
    updateKeyboardOffset();
    void sheet.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => backdrop.classList.add('open'));
    });
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close(true);
    }
  });

  sheet.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    swipeStart = { x: event.clientX, y: event.clientY };
    swipeLatest = { ...swipeStart };
    swipeMode = null;
  });

  sheet.addEventListener('pointermove', (event) => {
    if (!swipeStart || event.pointerType !== 'touch') {
      return;
    }

    swipeLatest = { x: event.clientX, y: event.clientY };
    const deltaX = swipeLatest.x - swipeStart.x;
    const deltaY = swipeLatest.y - swipeStart.y;

    if (!swipeMode && Math.hypot(deltaX, deltaY) > 5) {
      swipeMode = Math.abs(deltaX) > Math.abs(deltaY) ? 'page' : 'close';
    }

    if (swipeMode) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (swipeMode === 'close') {
      sheet.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
    }
  });

  function finishSwipe() {
    if (!swipeStart) {
      return;
    }

    const deltaX = (swipeLatest?.x ?? swipeStart.x) - swipeStart.x;
    const deltaY = (swipeLatest?.y ?? swipeStart.y) - swipeStart.y;
    const mode = swipeMode;
    swipeStart = null;
    swipeLatest = null;
    swipeMode = null;
    sheet.style.transform = '';

    if (mode === 'page' && Math.abs(deltaX) > 28) {
      showPage(currentPage + (deltaX < 0 ? 1 : -1));
    } else if (mode === 'close' && deltaY > 45) {
      close(true);
    }
  }

  sheet.addEventListener('pointerup', finishSwipe);
  sheet.addEventListener('pointercancel', finishSwipe);

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
