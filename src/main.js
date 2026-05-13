import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog/index.js';
import { createRaycaster } from './core/raycast.js';
import { createScene } from './core/scene.js';
import { createDragging } from './editor/dragging.js';
import { createObjectRenderer } from './editor/objectRenderer.js';
import { createSelection } from './editor/selection.js';
import { createContextMenu } from './ui/contextMenu.js';
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
const rotateSelectedButton = document.getElementById('rotate-selected');
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
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: null,
};

const raycast = createRaycaster({ renderer, camera, ground, objectLayer });
const objectRenderer = createObjectRenderer(objectLayer);
const { objectMeshes } = objectRenderer;
let selectedObjectId = null;
let contextMenuController = null;

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
    dragging.stopDragging();
    status.textContent = 'No selection';
  }
}

function rotateSelected() {
  const object = selectedObjectId ? getObjectById(selectedObjectId) : null;

  if (!object) {
    return;
  }

  object.rotation.y += Math.PI / 2;
  renderObjects();
  propertiesPanel.update();
  status.textContent = `Rotated ${object.id}`;
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

function spawnObject(type, position = dragging.getLastGroundHit()) {
  if (!catalog[type]) {
    console.warn(`Unknown object type: ${type}`);
    return;
  }

  const object = addObject(type, {
    x: snapToGrid(position.x),
    y: position.y ?? 0,
    z: snapToGrid(position.z),
  });

  renderObjects();
  selectObject(object.id);
  status.textContent = `Added ${catalog[type].label}`;
}

const dragging = createDragging({
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
  hideContextMenu: () => contextMenuController?.hide(),
  setStatus: (message) => {
    status.textContent = message;
  },
});

contextMenuController = createContextMenu({
  renderer,
  getGroundHit: raycast.getGroundHit,
  spawnObject,
  getLastGroundHit: dragging.getLastGroundHit,
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
    spawnObject(button.dataset.addObject);
  });
});

moveToolButton.addEventListener('click', () => selection.setTransformMode('translate'));
rotateToolButton.addEventListener('click', () => selection.setTransformMode('rotate'));
rotateSelectedButton.addEventListener('click', rotateSelected);
duplicateSelectedButton.addEventListener('click', duplicateSelected);
deleteSelectedButton.addEventListener('click', deleteSelected);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const isFormControl = target instanceof HTMLElement
    && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);

  if (isFormControl) {
    return;
  }

  if (event.key === 'Escape') {
    selectObject(null);
  } else if (event.key === 'w' || event.key === 'W') {
    selection.setTransformMode('translate');
  } else if (event.key === 'e' || event.key === 'E') {
    selection.setTransformMode('rotate');
  } else if (event.key === 'r' || event.key === 'R') {
    rotateSelected();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelected();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    duplicateSelected();
  }
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
