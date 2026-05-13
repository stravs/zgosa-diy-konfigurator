import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog, createObjectMesh } from './catalog/index.js';
import { createRaycaster } from './core/raycast.js';
import { createScene } from './core/scene.js';
import { createDragging } from './editor/dragging.js';
import { createMeasureTool } from './editor/measureTool.js';
import { createObjectRenderer } from './editor/objectRenderer.js';
import { createSelection } from './editor/selection.js';
import { createShortcuts } from './editor/shortcuts.js';
import { createLayersPanel } from './ui/layersPanel.js';
import { createPropertiesPanel } from './ui/propertiesPanel.js';
import { createToolbar } from './ui/toolbar.js';
import { createHistory } from './state/history.js';
import {
  addObject,
  createGroup,
  duplicateObject,
  getGroupById,
  getObjectById,
  removeGroup,
  removeObject,
  renameGroup as renameGroupState,
  state,
} from './state/store.js';

const app = document.getElementById('app');
const status = document.getElementById('status');
const toggleGridInput = document.getElementById('toggle-grid');
const objectsHandleButton = document.getElementById('objects-handle');
const layersHandleButton = document.getElementById('layers-handle');
const mobileMoveButton = document.getElementById('mobile-move');
const mobileRotateButton = document.getElementById('mobile-rotate');
const mobileMeasureButton = document.getElementById('mobile-measure');
const mobileUndoButton = document.getElementById('mobile-undo');
const mobileRedoButton = document.getElementById('mobile-redo');
const mobileDeleteButton = document.getElementById('mobile-delete');
const leftPanel = document.querySelector('.left-panel');
const rightPanel = document.querySelector('.right-panel');

const {
  renderer,
  scene,
  camera,
  ground,
  grid,
  objectLayer,
} = createScene(app);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 4;
controls.maxDistance = 80;
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};
renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

const raycast = createRaycaster({ renderer, camera, ground, objectLayer });
const objectRenderer = createObjectRenderer(objectLayer);
const { objectMeshes } = objectRenderer;
let selectedObjectId = null;
let selectedGroupId = null;
let pendingObjectType = null;
let previewMesh = null;
let dragging = null;

const history = createHistory({
  onRestore: () => {
    selectedGroupId = null;
    selectedObjectId = null;
    selection.select(null);
    renderObjects();
    propertiesPanel.update();
    layersPanel.update();
    status.textContent = 'Restored history';
  },
});

const layersPanel = createLayersPanel({
  selectObject,
  selectGroup,
  renameGroup,
});

const propertiesPanel = createPropertiesPanel({
  getObject: () => selectedObjectId ? getObjectById(selectedObjectId) : null,
  snapToGrid,
  onBeforeChange: () => history.record(),
  onChange: (object) => {
    renderObjects();
    propertiesPanel.update();
    status.textContent = `Updated ${object.id}`;
  },
});

function snapToGrid(value) {
  const gridSize = state.scene.gridSize;
  return Math.round(value / gridSize) * gridSize;
}

const measureTool = createMeasureTool({
  scene,
  renderer,
  raycast,
  setStatus: (message) => {
    status.textContent = message;
  },
});

const selection = createSelection({
  scene,
  camera,
  renderer,
  controls,
  objectMeshes,
  onTransformStart: () => history.record(),
  onChange: () => {
    propertiesPanel.update();
  },
  setStatus: (message) => {
    status.textContent = message;
  },
});

function renderObjects() {
  objectRenderer.render();
  selection.updateHelper();
  layersPanel.update();
}

function showSelectionStatus(selectedIds) {
  selectedObjectId = selectedIds.length === 1 ? selectedIds[0] : null;
  propertiesPanel.update();
  layersPanel.update();

  if (selectedGroupId) {
    const group = getGroupById(selectedGroupId);
    status.textContent = group ? `Selected group: ${group.name}` : 'Selected group';
  } else if (selectedIds.length > 1) {
    status.textContent = `Selected ${selectedIds.length} objects`;
  } else if (selectedIds.length === 1) {
    status.textContent = `Selected ${selectedIds[0]}`;
  } else {
    dragging?.stopDragging();
    status.textContent = 'No selection';
  }
}

function getGroupForObject(objectId) {
  return state.groups.find((group) => group.objectIds.includes(objectId)) ?? null;
}

function selectObject(objectId, options = {}) {
  measureTool.clear();

  const group = objectId && !options.editGroupItem && !options.skipGroupSelect
    ? getGroupForObject(objectId)
    : null;

  if (group && !options.toggle) {
    selectGroup(group.id);
    return;
  }

  selectedGroupId = null;

  if (options.toggle) {
    selection.toggle(objectId);
  } else {
    selection.select(objectId);
  }

  showSelectionStatus(selection.getSelectedIds());
}

function selectObjects(objectIds, options = {}) {
  measureTool.clear();
  selectedGroupId = options.groupId ?? null;
  selection.selectMany(objectIds);
  showSelectionStatus(selection.getSelectedIds());
}

function selectGroup(groupId) {
  const group = getGroupById(groupId);

  if (!group) {
    return;
  }

  selectObjects(group.objectIds, { groupId });
}

function groupSelected() {
  const selectedIds = selection.getSelectedIds();

  if (selectedIds.length < 2) {
    status.textContent = 'Select at least 2 objects to group';
    return;
  }

  history.record();
  const group = createGroup(selectedIds);

  if (!group) {
    status.textContent = 'Select at least 2 objects to group';
    return;
  }

  selectGroup(group.id);
  layersPanel.update();
  status.textContent = `Created ${group.name}`;
}

function renameGroup(groupId, name) {
  history.record();
  const group = renameGroupState(groupId, name);

  if (!group) {
    status.textContent = 'Could not rename group';
    return;
  }

  layersPanel.update();
  status.textContent = `Renamed group: ${group.name}`;
}

function ungroupSelected() {
  if (!selectedGroupId) {
    status.textContent = 'Select a group to ungroup';
    return;
  }

  history.record();
  const group = removeGroup(selectedGroupId);
  selectedGroupId = null;
  layersPanel.update();
  status.textContent = group ? `Ungrouped ${group.name}` : 'Group not found';
}

function deleteSelected() {
  const selectedIds = selection.getSelectedIds();

  if (selectedIds.length === 0) {
    return;
  }

  history.record();

  if (selectedGroupId) {
    removeGroup(selectedGroupId);
    selectedGroupId = null;
  }

  for (const id of selectedIds) {
    removeObject(id);
  }

  selectObject(null);
  renderObjects();
  propertiesPanel.update();
  status.textContent = `Deleted ${selectedIds.length} object${selectedIds.length === 1 ? '' : 's'}`;
}

function duplicateSelected() {
  if (!selectedObjectId) {
    return;
  }

  history.record();
  const copy = duplicateObject(selectedObjectId, {
    x: 1,
    z: 1,
  });

  if (!copy) {
    return;
  }

  renderObjects();
  selectObject(copy.id);
  status.textContent = `Duplicated ${copy.id}`;
}

function getPreviewParams(type) {
  if (type === 'box') return { width: 2.4, height: 0.45, depth: 1.2 };
  if (type === 'ledge') return { width: 3.0, height: 0.35, depth: 0.6 };
  if (type === 'quarterPipe') return { width: 2.4, height: 1.2, radius: 2.0, deckDepth: 0.8 };
  if (type === 'halfPipe') return { width: 2.4, height: 1.2, radius: 2.0, flatLength: 1.5, deckDepth: 0.8 };
  if (type === 'corner') return { width: 2.4, height: 1.2, radius: 2.0, deckDepth: 0.8, degrees: 90 };
  if (type === 'hip') return { height: 1.2, radius: 2.0, degrees: 90 };
  if (type === 'volcano') return { height: 1.2, radius: 2.0, topRadius: 0.6 };
  if (type === 'boob') return { height: 0.8, radius: 1.8 };
  if (type === 'bank') return { width: 2.4, height: 0.8, length: 2.4 };
  if (type === 'pyramid') return { height: 0.8, length: 2.0, topSize: 1.2 };
  if (type === 'rail') return { height: 0.7, length: 3.0, railRadius: 0.05 };
  if (type === 'stairs') return { width: 2.4, height: 0.18, stepCount: 5, treadDepth: 0.35 };
  if (type === 'skater') return { height: 1.8 };
  return {};
}

function spawnObject(type, position = null) {
  if (!catalog[type]) {
    console.warn(`Unknown object type: ${type}`);
    return;
  }

  const spawnPosition = position ?? dragging?.getLastGroundHit() ?? { x: 0, y: 0, z: 0 };
  history.record();
  const object = addObject(type, {
    x: snapToGrid(spawnPosition.x),
    y: spawnPosition.y ?? 0,
    z: snapToGrid(spawnPosition.z),
  });

  renderObjects();
  selectObject(object.id);
  status.textContent = `Added ${catalog[type].label}`;
}

function clearPlacementPreview() {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh = null;
  }

  pendingObjectType = null;
}

function startPlacement(type) {
  closeMobileDrawers();

  if (!catalog[type]) {
    console.warn(`Unknown object type: ${type}`);
    return;
  }

  clearPlacementPreview();
  pendingObjectType = type;
  const previewObject = {
    id: '__preview__',
    type,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    params: getPreviewParams(type),
  };

  previewMesh = createObjectMesh(previewObject);
  scene.add(previewMesh);
  selectObject(null);
  status.textContent = `Placing ${catalog[type].label}. Left click to place.`;
}

function updatePlacementPreview(hit) {
  if (!previewMesh || !hit) {
    return;
  }

  previewMesh.visible = true;
  previewMesh.position.set(
    snapToGrid(hit.point.x),
    0,
    snapToGrid(hit.point.z)
  );
}

function placePendingObject(hit) {
  if (!pendingObjectType || !hit) {
    return false;
  }

  spawnObject(pendingObjectType, {
    x: hit.point.x,
    y: 0,
    z: hit.point.z,
  });
  clearPlacementPreview();
  return true;
}

dragging = createDragging({
  scene,
  renderer,
  camera,
  raycast,
  controls,
  selection,
  objectMeshes,
  selectObject,
  selectObjects,
  getSelectedId: () => selectedObjectId,
  getObjectById,
  snapToGrid,
  onBeforeChange: () => history.record(),
  updateProperties: () => propertiesPanel.update(),
  hideContextMenu: () => {},
  setStatus: (message) => {
    status.textContent = message;
  },
  onGroundMove: updatePlacementPreview,
  onPrimaryClick: (hit) => {
    if (measureTool.isActive()) {
      return true;
    }

    return placePendingObject(hit);
  },
});

createToolbar({
  beforeReset: () => history.record(),
  beforeLoad: () => history.record(),
  afterReset: () => {
    selectObject(null);
    renderObjects();
    propertiesPanel.update();
  },
  afterLoad: () => {
    selectObject(null);
    renderObjects();
    propertiesPanel.update();
  },
  setStatus: (message) => {
    status.textContent = message;
  },
});
toggleGridInput.addEventListener('change', () => {
  grid.visible = toggleGridInput.checked;
});

document.querySelectorAll('[data-add-object]').forEach((button) => {
  button.addEventListener('click', () => {
    startPlacement(button.dataset.addObject);
  });
});

function undoAction() {
  status.textContent = history.undo() ? 'Undo' : 'Nothing to undo';
}

function redoAction() {
  status.textContent = history.redo() ? 'Redo' : 'Nothing to redo';
}

function clearDrawerInlineStyles() {
  leftPanel.style.transform = '';
  rightPanel.style.transform = '';
  objectsHandleButton.style.transform = '';
  layersHandleButton.style.transform = '';
}

function closeMobileDrawers() {
  document.body.classList.remove('show-objects-panel', 'show-right-panel');
  leftPanel.classList.remove('drawer-open');
  rightPanel.classList.remove('drawer-open');
  clearDrawerInlineStyles();
}

function openObjectsDrawer() {
  closeMobileDrawers();
  document.body.classList.add('show-objects-panel');
  leftPanel.classList.add('drawer-open');
}

function openLayersDrawer() {
  closeMobileDrawers();
  document.body.classList.add('show-right-panel');
  rightPanel.classList.add('drawer-open');
}

function toggleObjectsDrawer() {
  if (leftPanel.classList.contains('drawer-open')) {
    closeMobileDrawers();
  } else {
    openObjectsDrawer();
  }
}

function toggleLayersDrawer() {
  if (rightPanel.classList.contains('drawer-open')) {
    closeMobileDrawers();
  } else {
    openLayersDrawer();
  }
}

function setDrawerProgress(panel, handle, side, progress) {
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
  const width = panel.getBoundingClientRect().width;

  if (side === 'left') {
    panel.style.transform = `translateX(${(clampedProgress - 1) * 100}%)`;
    handle.style.transform = `translateY(-50%) translateX(${clampedProgress * width}px)`;
  } else {
    panel.style.transform = `translateX(${(1 - clampedProgress) * 100}%)`;
    handle.style.transform = `translateY(-50%) translateX(${-clampedProgress * width}px)`;
  }
}

function createDrawerHandleDrag({ handle, panel, side, open }) {
  let startX = 0;
  let startProgress = 0;
  let latestProgress = 0;
  let didDrag = false;

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    startX = event.clientX;
    startProgress = panel.classList.contains('drawer-open') ? 1 : 0;
    latestProgress = startProgress;
    didDrag = false;
    panel.style.transition = 'none';
    handle.style.transition = 'none';
  });

  handle.addEventListener('pointermove', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) {
      return;
    }

    const width = panel.getBoundingClientRect().width;
    const delta = side === 'left' ? event.clientX - startX : startX - event.clientX;
    latestProgress = THREE.MathUtils.clamp(startProgress + (delta / width), 0, 1);
    didDrag = didDrag || Math.abs(delta) > 4;
    setDrawerProgress(panel, handle, side, latestProgress);
  });

  handle.addEventListener('pointerup', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) {
      return;
    }

    handle.releasePointerCapture(event.pointerId);
    panel.style.transition = '';
    handle.style.transition = '';

    if (!didDrag) {
      open();
      return;
    }

    if (latestProgress > 0.45) {
      open();
    } else {
      closeMobileDrawers();
    }
  });
}

createDrawerHandleDrag({
  handle: objectsHandleButton,
  panel: leftPanel,
  side: 'left',
  open: toggleObjectsDrawer,
});

createDrawerHandleDrag({
  handle: layersHandleButton,
  panel: rightPanel,
  side: 'right',
  open: toggleLayersDrawer,
});

mobileMoveButton.addEventListener('click', () => {
  closeMobileDrawers();
  selection.setTransformMode('translate');
});

mobileRotateButton.addEventListener('click', () => {
  closeMobileDrawers();
  selection.setTransformMode('rotate');
});

mobileMeasureButton.addEventListener('click', () => {
  closeMobileDrawers();
  selectObject(null);
  measureTool.activate();
});

mobileUndoButton.addEventListener('click', undoAction);
mobileRedoButton.addEventListener('click', redoAction);
mobileDeleteButton.addEventListener('click', deleteSelected);

createShortcuts({
  unselect: () => selectObject(null),
  setMoveTool: () => selection.setTransformMode('translate'),
  setRotateTool: () => selection.setTransformMode('rotate'),
  activateMeasureTool: () => {
    selectObject(null);
    measureTool.activate();
  },
  deleteSelected,
  duplicateSelected,
  groupSelected,
  ungroupSelected,
  undo: undoAction,
  redo: redoAction,
});

propertiesPanel.update();
layersPanel.update();

function onResize() {
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight);
}

window.addEventListener('resize', onResize);

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
