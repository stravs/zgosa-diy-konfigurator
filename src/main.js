import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog/index.js';
import { preventBrowserZoom } from './core/browserZoom.js';
import { getDevicePixelRatioCap, isMobileQuality } from './core/performance.js';
import { createRaycaster } from './core/raycast.js';
import { createScene } from './core/scene.js';
import { createDragging } from './editor/dragging.js';
import { createMeasureTool } from './editor/measureTool.js';
import { createObjectRenderer } from './editor/objectRenderer.js';
import { createPlacementController } from './editor/placement.js';
import { createSelection } from './editor/selection.js';
import { createShortcuts } from './editor/shortcuts.js';
import { createDrawers } from './ui/drawers.js';
import { createLayersPanel } from './ui/layersPanel.js';
import { createMobileToolbar } from './ui/mobileToolbar.js';
import { createPropertiesPanel } from './ui/propertiesPanel.js';
import { createPropertySheet } from './ui/propertySheet.js';
import { createToolbar } from './ui/toolbar.js';
import { createTopMenu } from './ui/topMenu.js';
import { createHistory } from './state/history.js';
import {
  addObject,
  createGroup,
  duplicateObject,
  getGroupById,
  getObjectById,
  loadState,
  removeGroup,
  removeObject,
  renameGroup as renameGroupState,
  setGroupLocked,
  setObjectLocked,
  state,
} from './state/store.js';

preventBrowserZoom();

const app = document.getElementById('app');
const status = document.getElementById('status');
const toggleGridInput = document.getElementById('toggle-grid');
const toggleEditBaseInput = document.getElementById('toggle-edit-base');
const objectsHandleButton = document.getElementById('objects-handle');
const layersHandleButton = document.getElementById('layers-handle');
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
controls.enableDamping = false;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = isMobileQuality() ? 1.2 : 4;
controls.maxDistance = 80;
controls.enablePan = true;
controls.enableZoom = true;
controls.screenSpacePanning = false;
controls.panSpeed = isMobileQuality() ? 0.8 : 1;
controls.zoomSpeed = isMobileQuality() ? 0.7 : 1;
controls.rotateSpeed = isMobileQuality() ? 0.75 : 1;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: THREE.MOUSE.PAN,
};
renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

let renderQueued = false;

function renderScene() {
  renderQueued = false;
  renderer.render(scene, camera);
}

function requestRender() {
  if (renderQueued) {
    return;
  }

  renderQueued = true;
  requestAnimationFrame(renderScene);
}

controls.addEventListener('change', requestRender);

toggleGridInput.checked = false;
grid.visible = false;

const raycast = createRaycaster({ renderer, camera, ground, objectLayer });
const objectRenderer = createObjectRenderer(objectLayer);
const { objectMeshes } = objectRenderer;
let selectedObjectId = null;
let selectedGroupId = null;
let dragging = null;
let placement = null;
let drawers = null;
let initialObjectIds = new Set();
let initialGroupIds = new Set();
let canEditBase = false;

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

function isBaseObject(objectId) {
  return initialObjectIds.has(objectId);
}

function getGroupForObject(objectId) {
  return state.groups.find((group) => group.objectIds.includes(objectId)) ?? null;
}

function isBaseObjectLocked(objectId) {
  return !canEditBase && isBaseObject(objectId);
}

function isGroupLocked(groupId) {
  const group = getGroupById(groupId);
  return Boolean(group?.locked) || (!canEditBase && initialGroupIds.has(groupId));
}

function isObjectLocked(objectId) {
  const object = getObjectById(objectId);
  const group = getGroupForObject(objectId);
  return Boolean(object?.locked) || isBaseObjectLocked(objectId) || Boolean(group && isGroupLocked(group.id));
}

function isBaseGroup(groupId) {
  return initialGroupIds.has(groupId);
}

let propertySheet = null;

const layersPanel = createLayersPanel({
  selectObject,
  selectGroup,
  renameGroup,
  openObjectProperties: (objectId) => {
    drawers?.closeLayersDrawer();
    propertySheet?.open(objectId);
  },
  toggleObjectLocked,
  toggleGroupLocked,
  isObjectLocked,
  isGroupLocked,
  shouldShowObject: (object) => canEditBase || !isBaseObject(object.id),
  shouldShowGroup: (group) => canEditBase || !isBaseGroup(group.id),
});

propertySheet = createPropertySheet({
  getObjectById,
  snapToGrid,
  onBeforeChange: () => history.record(),
  onChange: () => {
    renderObjects();
    propertiesPanel.update();
    requestRender();
  },
  onConfirm: (objectId) => {
    selectObject(objectId, { skipGroupSelect: true });
    selection.setTransformMode('translate');
  },
  onCancel: (objectId, { wasNew }) => {
    if (wasNew) {
      removeObject(objectId);
      selectObject(null);
      renderObjects();
      status.textContent = 'Canceled object';
    }
  },
});

const propertiesPanel = createPropertiesPanel({
  getObject: () => selectedObjectId ? getObjectById(selectedObjectId) : null,
  snapToGrid,
  onBeforeChange: () => history.record(),
  onChange: (object) => {
    renderObjects();
    propertiesPanel.update();
    requestRender();
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
  requestRender,
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
    requestRender();
  },
  setStatus: (message) => {
    status.textContent = message;
    requestRender();
  },
});

function renderObjects() {
  objectRenderer.render();
  selection.updateHelper();
  layersPanel.update();
  requestRender();
}

function showSelectionStatus(selectedIds) {
  selectedObjectId = selectedIds.length === 1 ? selectedIds[0] : null;
  propertiesPanel.update();
  layersPanel.update();
  requestRender();

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

function selectObject(objectId, options = {}) {
  measureTool.clear();

  if (objectId && isObjectLocked(objectId)) {
    return;
  }

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
  const editableObjectIds = objectIds.filter((objectId) => !isObjectLocked(objectId));
  selectedGroupId = options.groupId ?? null;
  selection.selectMany(editableObjectIds);
  showSelectionStatus(selection.getSelectedIds());
}

function selectGroup(groupId) {
  const group = getGroupById(groupId);

  if (!group) {
    return;
  }

  if (isGroupLocked(groupId)) {
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
  if (isGroupLocked(groupId)) {
    status.textContent = 'Group is locked';
    return;
  }

  history.record();
  const group = renameGroupState(groupId, name);

  if (!group) {
    status.textContent = 'Could not rename group';
    return;
  }

  layersPanel.update();
  status.textContent = `Renamed group: ${group.name}`;
}

function toggleObjectLocked(objectId) {
  const object = getObjectById(objectId);

  if (!object || isBaseObjectLocked(objectId)) {
    return;
  }

  history.record();
  setObjectLocked(objectId, !object.locked);

  if (isObjectLocked(objectId) && selection.getSelectedIds().includes(objectId)) {
    selectObject(null);
  }

  layersPanel.update();
  status.textContent = object.locked ? `Locked ${object.id}` : `Unlocked ${object.id}`;
}

function toggleGroupLocked(groupId) {
  const group = getGroupById(groupId);

  if (!group || (!canEditBase && isBaseGroup(groupId))) {
    return;
  }

  history.record();
  setGroupLocked(groupId, !group.locked);

  if (isGroupLocked(groupId) && selectedGroupId === groupId) {
    selectObject(null);
  }

  layersPanel.update();
  status.textContent = group.locked ? `Locked ${group.name}` : `Unlocked ${group.name}`;
}

function clearNewSceneObjects() {
  const newObjectIds = state.objects
    .filter((object) => !initialObjectIds.has(object.id))
    .map((object) => object.id);

  const newGroupIds = state.groups
    .filter((group) => !initialGroupIds.has(group.id))
    .map((group) => group.id);

  if (newObjectIds.length === 0 && newGroupIds.length === 0) {
    status.textContent = 'Nothing new to clear';
    return;
  }

  for (const groupId of newGroupIds) {
    removeGroup(groupId);
  }

  for (const objectId of newObjectIds) {
    removeObject(objectId);
  }
}

function ungroupSelected() {
  if (!selectedGroupId) {
    status.textContent = 'Select a group to ungroup';
    return;
  }

  if (isGroupLocked(selectedGroupId)) {
    status.textContent = 'Group is locked';
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

  if (selectedIds.some(isObjectLocked) || (selectedGroupId && isGroupLocked(selectedGroupId))) {
    status.textContent = 'Selection has locked items';
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

placement = createPlacementController({
  scene,
  catalog,
  addObject,
  snapToGrid,
  history,
  renderObjects,
  selectObject,
  propertySheet,
  closeMobileDrawers: () => drawers?.closeMobileDrawers(),
  getLastGroundHit: () => dragging?.getLastGroundHit(),
  setStatus: (message) => {
    status.textContent = message;
  },
  requestRender,
});

dragging = createDragging({
  scene,
  renderer,
  camera,
  raycast,
  controls,
  selection,
  objectMeshes,
  isObjectLocked,
  selectObject,
  selectObjects,
  getSelectedId: () => selectedObjectId,
  getObjectById,
  snapToGrid,
  onBeforeChange: () => history.record(),
  updateProperties: () => {
    propertiesPanel.update();
    requestRender();
  },
  hideContextMenu: () => {},
  setStatus: (message) => {
    status.textContent = message;
  },
  onGroundMove: placement.updatePlacementPreview,
  onPrimaryClick: (hit) => {
    if (measureTool.isActive()) {
      return true;
    }

    return placement.placePendingObject(hit);
  },
  onLongPressEmpty: () => drawers?.openObjectsDrawer(),
  onLongPressObject: (objectId) => {
    selectObject(objectId, { editGroupItem: true });
    propertySheet.open(objectId);
  },
  onDoubleClickObject: (objectId) => {
    selectObject(objectId, { editGroupItem: true });
    propertySheet.open(objectId);
  },
});

createToolbar({
  beforeReset: () => history.record(),
  resetSceneState: clearNewSceneObjects,
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
let topMenuPanel = null;

function setGridVisible(visible) {
  toggleGridInput.checked = visible;
  topMenuPanel?.setGridChecked(visible);
  grid.visible = visible;
  requestRender();
}

function setBaseEditing(enabled) {
  canEditBase = enabled;
  toggleEditBaseInput.checked = enabled;
  topMenuPanel?.setBaseEditingChecked(enabled);

  if (!canEditBase && selection.getSelectedIds().some(isBaseObject)) {
    selectObject(null);
  }

  layersPanel.update();
  status.textContent = canEditBase ? 'Base editing enabled' : 'Base editing disabled';
}

toggleGridInput.addEventListener('change', () => {
  setGridVisible(toggleGridInput.checked);
});

toggleEditBaseInput.addEventListener('change', () => {
  setBaseEditing(toggleEditBaseInput.checked);
});


document.querySelectorAll('[data-add-object]').forEach((button) => {
  button.addEventListener('click', () => {
    placement.startPlacement(button.dataset.addObject);
  });
});

function undoAction() {
  status.textContent = history.undo() ? 'Undo' : 'Nothing to undo';
}

function redoAction() {
  status.textContent = history.redo() ? 'Redo' : 'Nothing to redo';
}

drawers = createDrawers({
  leftPanel,
  rightPanel,
  objectsHandleButton,
  layersHandleButton,
});

const {
  closeLayersDrawer,
  closeMobileDrawers,
  openObjectsDrawer,
} = drawers;

topMenuPanel = createTopMenu({
  setGridVisible,
  setBaseEditing,
  ungroupSelected,
});

createMobileToolbar({
  closeMobileDrawers,
  selection,
  selectObject,
  measureTool,
  groupSelected,
  undoAction,
  redoAction,
  deleteSelected,
});

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

async function loadInitialScene() {
  try {
    const response = await fetch('./zgosa.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const snapshot = await response.json();
    loadState(snapshot);
    initialObjectIds = new Set(state.objects.map((object) => object.id));
    initialGroupIds = new Set(state.groups.map((group) => group.id));
    selectObject(null);
    renderObjects();
    propertiesPanel.update();
    layersPanel.update();
    status.textContent = `Loaded zgosa.json (${state.objects.length} objects)`;
  } catch (error) {
    console.error(error);
    status.textContent = 'Could not load zgosa.json';
  }
}

propertiesPanel.update();
layersPanel.update();
loadInitialScene();

function onResize() {
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getDevicePixelRatioCap()));
  renderer.setSize(app.clientWidth, app.clientHeight);
  requestRender();
}

window.addEventListener('resize', onResize);
requestRender();
