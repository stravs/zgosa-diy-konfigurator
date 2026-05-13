import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog, createObjectMesh } from './catalog/index.js';
import { createRaycaster } from './core/raycast.js';
import { createScene } from './core/scene.js';
import { createDragging } from './editor/dragging.js';
import { createObjectRenderer } from './editor/objectRenderer.js';
import { createSelection } from './editor/selection.js';
import { createShortcuts } from './editor/shortcuts.js';
import { createPropertiesPanel } from './ui/propertiesPanel.js';
import { createToolbar } from './ui/toolbar.js';
import {
  addObject,
  duplicateObject,
  getObjectById,
  removeObject,
  state,
} from './state/store.js';

const app = document.getElementById('app');
const status = document.getElementById('status');
const moveToolButton = document.getElementById('move-tool');
const rotateToolButton = document.getElementById('rotate-tool');
const duplicateSelectedButton = document.getElementById('duplicate-selected');
const deleteSelectedButton = document.getElementById('delete-selected');

const {
  renderer,
  scene,
  camera,
  ground,
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
let pendingObjectType = null;
let previewMesh = null;
let dragging = null;

const propertiesPanel = createPropertiesPanel({
  getObject: () => selectedObjectId ? getObjectById(selectedObjectId) : null,
  snapToGrid,
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

const selection = createSelection({
  scene,
  camera,
  renderer,
  controls,
  objectMeshes,
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
}

function selectObject(objectId) {
  selectedObjectId = objectId;
  selection.select(objectId);
  propertiesPanel.update();

  if (objectId) {
    status.textContent = `Selected ${objectId}`;
  } else {
    dragging?.stopDragging();
    status.textContent = 'No selection';
  }
}

function deleteSelected() {
  if (!selectedObjectId) {
    return;
  }

  const removedObject = removeObject(selectedObjectId);

  if (!removedObject) {
    return;
  }

  selectObject(null);
  renderObjects();
  propertiesPanel.update();
  status.textContent = `Deleted ${removedObject.id}`;
}

function duplicateSelected() {
  if (!selectedObjectId) {
    return;
  }

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
  if (type === 'bank') return { width: 2.4, height: 0.8, length: 2.4 };
  if (type === 'pyramid') return { height: 0.8, length: 2.0, topSize: 1.2 };
  if (type === 'rail') return { height: 0.7, length: 3.0, railRadius: 0.05 };
  if (type === 'stairs') return { width: 2.4, height: 0.18, stepCount: 5, treadDepth: 0.35 };
  return {};
}

function spawnObject(type, position = null) {
  if (!catalog[type]) {
    console.warn(`Unknown object type: ${type}`);
    return;
  }

  const spawnPosition = position ?? dragging?.getLastGroundHit() ?? { x: 0, y: 0, z: 0 };
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
  raycast,
  controls,
  selection,
  selectObject,
  getSelectedId: () => selectedObjectId,
  getObjectById,
  snapToGrid,
  updateProperties: () => propertiesPanel.update(),
  hideContextMenu: () => {},
  setStatus: (message) => {
    status.textContent = message;
  },
  onGroundMove: updatePlacementPreview,
  onPrimaryClick: placePendingObject,
});

createToolbar({
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
document.querySelectorAll('[data-add-object]').forEach((button) => {
  button.addEventListener('click', () => {
    startPlacement(button.dataset.addObject);
  });
});

moveToolButton.addEventListener('click', () => selection.setTransformMode('translate'));
rotateToolButton.addEventListener('click', () => selection.setTransformMode('rotate'));
duplicateSelectedButton.addEventListener('click', duplicateSelected);
deleteSelectedButton.addEventListener('click', deleteSelected);

createShortcuts({
  unselect: () => selectObject(null),
  setMoveTool: () => selection.setTransformMode('translate'),
  setRotateTool: () => selection.setTransformMode('rotate'),
  deleteSelected,
  duplicateSelected,
});

propertiesPanel.update();

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
