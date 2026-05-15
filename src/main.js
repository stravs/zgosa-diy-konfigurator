import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog/index.js';
import { preventBrowserZoom } from './core/browserZoom.js';
import {
  getDevicePixelRatioCap,
  hasCoarsePointer,
  isCompactLayout,
} from './core/performance.js';
import { createResponsiveController } from './app/responsiveController.js';
import { createRaycaster } from './core/raycast.js';
import { createScene } from './core/scene.js';
import { createDragging } from './editor/dragging.js';
import { createMeasureTool } from './editor/measureTool.js';
import { createObjectRenderer } from './editor/objectRenderer.js';
import { createPlacementController } from './editor/placement.js';
import { createScaleHandles } from './editor/scaleHandles.js';
import { createSelection } from './editor/selection.js';
import { createShortcuts } from './editor/shortcuts.js';
import { createDrawers } from './ui/drawers.js';
import { createSceneObjectsPanel } from './ui/sceneObjectsPanel.js';
import { createMobileToolbar } from './ui/mobileToolbar.js';
import { createObjectActions } from './ui/objectActions.js';
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

const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.48;
const CAMERA_MIN_DISTANCE = 4;
const CAMERA_MAX_DISTANCE = 80;
const TOUCH_DOUBLE_TAP_MS = 300;
const TOUCH_DOUBLE_TAP_PX = 28;
const TOUCH_DOUBLE_TAP_ZOOM_LERP = 0.3;

preventBrowserZoom();

const app = document.getElementById('app');
const status = document.getElementById('status');
const toggleGridInput = document.getElementById('toggle-grid');
const toggleEditBaseInput = document.getElementById('toggle-edit-base');
const objectsHandleButton = document.getElementById('objects-handle');
const sceneHandleButton = document.getElementById('scene-handle');
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
controls.maxPolarAngle = CAMERA_MAX_POLAR_ANGLE;
controls.minDistance = CAMERA_MIN_DISTANCE;
controls.maxDistance = CAMERA_MAX_DISTANCE;
controls.enablePan = true;
controls.enableZoom = true;
controls.screenSpacePanning = false;
controls.panSpeed = 1;
controls.zoomSpeed = 1;
controls.rotateSpeed = 1;
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

let lastTouchTap = null;

renderer.domElement.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'touch') {
    return;
  }

  const now = window.performance.now();
  const tap = { time: now, x: event.clientX, y: event.clientY };
  const isDoubleTap = lastTouchTap
    && now - lastTouchTap.time < TOUCH_DOUBLE_TAP_MS
    && Math.hypot(event.clientX - lastTouchTap.x, event.clientY - lastTouchTap.y) < TOUCH_DOUBLE_TAP_PX;

  lastTouchTap = tap;

  if (!isDoubleTap) {
    return;
  }

  event.preventDefault();
  const nextPosition = camera.position.clone().lerp(controls.target, TOUCH_DOUBLE_TAP_ZOOM_LERP);

  if (nextPosition.distanceTo(controls.target) >= controls.minDistance) {
    camera.position.copy(nextPosition);
    controls.update();
    requestRender();
  }
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

controls.addEventListener('change', handleCameraChange);

toggleGridInput.checked = false;
grid.visible = false;

const raycast = createRaycaster({ renderer, camera, ground, objectLayer });
const objectRenderer = createObjectRenderer(objectLayer);
const { objectMeshes } = objectRenderer;
let selectedObjectId = null;
let selectedGroupId = null;
let dragging = null;
let placement = null;
let scaleHandles = null;
let objectActions = null;
let drawers = null;
let initialObjectIds = new Set();
let initialGroupIds = new Set();
let canEditBase = false;
let activeTool = 'move';

const history = createHistory({
  onRestore: () => {
    selectedGroupId = null;
    selectedObjectId = null;
    selection.select(null);
    renderObjects();
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

const sceneObjectsPanel = createSceneObjectsPanel({
  selectObject,
  selectGroup,
  renameGroup,
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
  },
  onConfirm: (objectId) => {
    selectObject(objectId, { skipGroupSelect: true });
    setMoveTool();
    objectActions?.expand();
  },
  onCancel: (objectId, { wasNew }) => {
    if (wasNew) {
      removeObject(objectId);
      selectObject(null);
      renderObjects();
      status.textContent = 'Canceled object';
    } else {
      objectActions?.expand();
    }
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
  onActiveChange: (active) => {
    document.getElementById('mobile-measure')?.classList.toggle('active', active);
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
    syncCameraAnchoredUi();
    requestRender();
  },
  setStatus: (message) => {
    status.textContent = message;
    requestRender();
  },
});

scaleHandles = createScaleHandles({
  scene,
  camera,
  renderer,
  controls,
  selection,
  objectMeshes,
  getObjectById,
  getSelectedGroupId: () => selectedGroupId,
  isObjectLocked,
  snapToGrid,
  onBeforeChange: () => history.record(),
  onChange: (object) => {
    renderObjects();
    status.textContent = `Scaled ${object.id}`;
  },
  setStatus: (message) => {
    status.textContent = message;
  },
  requestRender,
});

function enableCameraControls() {
  controls.enabled = true;
}

function setSelectTool() {
  activeTool = 'select';
  scaleHandles?.hide();
  selection.setTransformEnabled(false);
  enableCameraControls();
  status.textContent = 'Select tool active: click or tap objects';
}

function setMoveTool() {
  activeTool = 'move';
  objectActions?.setActiveIcon('↔');
  scaleHandles?.hide();
  selection.setTransformEnabled(false);
  enableCameraControls();
  status.textContent = 'Move tool active: drag selected object';
}

function setRotateTool() {
  activeTool = 'rotate';
  objectActions?.setActiveIcon('⟳');
  scaleHandles?.hide();
  selection.setTransformEnabled(false);
  enableCameraControls();
}

function setScaleTool() {
  activeTool = 'scale';
  objectActions?.setActiveIcon('⬚');
  selection.setTransformEnabled(false);
  scaleHandles?.setEnabled(true);
  enableCameraControls();

  const selectedIds = selection.getSelectedIds();
  const object = selectedIds.length === 1 ? getObjectById(selectedIds[0]) : null;

  if (selectedIds.length !== 1 || selectedGroupId) {
    status.textContent = 'Extend works on one box';
  } else if (object?.type !== 'box') {
    status.textContent = 'Extend supports Box only for now';
  } else {
    status.textContent = 'Extend box face';
  }
}

function updateActiveTool() {
  if (activeTool === 'scale') {
    selection.setTransformEnabled(false);
    scaleHandles?.setEnabled(true);
  } else {
    scaleHandles?.hide();
    selection.setTransformEnabled(false);
  }
}

function resetDefaultTool() {
  activeTool = 'move';
  objectActions?.setActiveIcon('↔');
  scaleHandles?.hide();
  selection.setTransformEnabled(false);
  enableCameraControls();
}

objectActions = createObjectActions({
  camera,
  renderer,
  objectMeshes,
  selection,
  getSelectedGroupId: () => selectedGroupId,
  getObjectById,
  setMoveTool,
  setRotateTool,
  setScaleTool,
  groupSelected,
  ungroupSelected,
  deleteSelected,
  openProperties: (objectId) => {
    objectActions?.hide();
    propertySheet.open(objectId);
  },
  shouldHide: () => propertySheet.isOpen(),
});

function syncSceneObjects() {
  objectRenderer.render();
  selection.updateHelper();
  scaleHandles?.update();
}

function syncSelectionUi() {
  sceneObjectsPanel.update();
  objectActions?.update();
}

function syncCameraAnchoredUi() {
  scaleHandles?.update();
  objectActions?.update();
}

function handleCameraChange() {
  syncCameraAnchoredUi();
  requestRender();
}

function renderObjects() {
  syncSceneObjects();
  syncSelectionUi();
  requestRender();
}

function showSelectionStatus(selectedIds) {
  selectedObjectId = selectedIds.length === 1 ? selectedIds[0] : null;
  resetDefaultTool();
  syncSelectionUi();
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

  if (selectedGroupId) {
    ungroupSelected();
    return;
  }

  if (selectedIds.length < 2) {
    status.textContent = 'Select at least 2 objects to group';
    return;
  }

  const selectedKey = [...selectedIds].sort().join('\0');
  const existingGroup = state.groups.find((group) => [...group.objectIds].sort().join('\0') === selectedKey);

  if (existingGroup) {
    selectGroup(existingGroup.id);
    ungroupSelected();
    return;
  }

  history.record();
  const group = createGroup(selectedIds);

  if (!group) {
    status.textContent = 'Select at least 2 objects to group';
    return;
  }

  selectGroup(group.id);
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

  syncSelectionUi();
  status.textContent = `Renamed group: ${group.name}`;
}

function toggleObjectLocked(objectId) {
  const object = getObjectById(objectId);

  if (!object || isBaseObjectLocked(objectId)) {
    return;
  }

  const nextLocked = !object.locked;

  history.record();
  setObjectLocked(objectId, nextLocked);

  if (isObjectLocked(objectId) && selection.getSelectedIds().includes(objectId)) {
    selectObject(null);
  }

  syncSelectionUi();
  status.textContent = nextLocked ? `Locked ${object.id}` : `Unlocked ${object.id}`;
}

function toggleGroupLocked(groupId) {
  const group = getGroupById(groupId);

  if (!group || (!canEditBase && isBaseGroup(groupId))) {
    return;
  }

  const nextLocked = !group.locked;

  history.record();
  setGroupLocked(groupId, nextLocked);

  if (isGroupLocked(groupId) && selectedGroupId === groupId) {
    selectObject(null);
  }

  syncSelectionUi();
  status.textContent = nextLocked ? `Locked ${group.name}` : `Unlocked ${group.name}`;
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
  syncSelectionUi();
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
  closeMobileDrawers: () => drawers?.closeMobileDrawers(),
  getLastGroundHit: () => dragging?.getLastGroundHit(),
  setStatus: (message) => {
    status.textContent = message;
  },
  requestRender,
});

dragging = createDragging({
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
  canDragObject: () => activeTool === 'move',
  canRotateObject: () => activeTool === 'rotate',
  canToggleSelect: () => false,
  onObjectDragEnd: enableCameraControls,
  updateProperties: () => {
    syncCameraAnchoredUi();
    requestRender();
  },
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
  onSceneTap: () => drawers?.closeMobileDrawers(),
  onLongPressObject: (objectId) => {
    const group = getGroupForObject(objectId);

    if (group && !isGroupLocked(group.id)) {
      selectGroup(group.id);
      return;
    }

    const selectedIds = selection.getSelectedIds();
    const shouldAddToSelection = selectedIds.length > 0 && !selectedIds.includes(objectId) && !selectedGroupId;

    selectObject(objectId, {
      editGroupItem: true,
      toggle: shouldAddToSelection,
    });
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
  },
  afterLoad: () => {
    selectObject(null);
    renderObjects();
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

  syncSelectionUi();
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
    if (isCompactLayout()) {
      drawers?.closeMobileDrawers();
      placement.spawnObject(button.dataset.addObject);
    } else {
      placement.startPlacement(button.dataset.addObject);
    }
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
  sceneHandleButton,
});

const { closeMobileDrawers } = drawers;
topMenuPanel = createTopMenu({
  setGridVisible,
  setBaseEditing,
});

createMobileToolbar({
  closeMobileDrawers,
  selectObject,
  measureTool,
  undoAction,
  redoAction,
});

createShortcuts({
  unselect: () => selectObject(null),
  setMoveTool,
  setRotateTool,
  setScaleTool,
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
    status.textContent = `Loaded zgosa.json (${state.objects.length} objects)`;
  } catch (error) {
    console.error(error);
    status.textContent = 'Could not load zgosa.json';
  }
}

syncSelectionUi();
loadInitialScene();

createResponsiveController({
  app,
  camera,
  renderer,
  controls,
  drawers,
  getDevicePixelRatioCap,
  hasCoarsePointer,
  isCompactLayout,
  onToolModeChange: () => {
    updateActiveTool();
    enableCameraControls();
  },
  onCameraChange: syncCameraAnchoredUi,
  onDesktopLayout: () => topMenuPanel?.close(),
  requestRender,
});

requestRender();
