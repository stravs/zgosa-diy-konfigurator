import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog/index.js';
import { createScene } from './core/scene.js';
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

const marker = new THREE.Mesh(
  new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24),
  new THREE.MeshStandardMaterial({ color: 0xf97316 })
);
marker.position.y = 0.025;
marker.visible = false;
scene.add(marker);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const objectRenderer = createObjectRenderer(objectLayer);
const { objectMeshes } = objectRenderer;
let lastGroundHit = { x: 0, y: 0, z: 0 };
let selectedObjectId = null;
let isDraggingObject = false;
let dragOffset = { x: 0, z: 0 };

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
    isDraggingObject = false;
    controls.enabled = true;
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

function spawnObject(type, position = lastGroundHit) {
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

function updateRaycaster(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function getGroundHit(event) {
  updateRaycaster(event);
  const [hit] = raycaster.intersectObject(ground);
  return hit ?? null;
}

const contextMenuController = createContextMenu({
  renderer,
  getGroundHit,
  spawnObject,
  getLastGroundHit: () => lastGroundHit,
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

function updateGroundMarker(hit) {
  if (!hit) {
    marker.visible = false;
    status.textContent = 'Ground hit: —';
    return;
  }

  lastGroundHit = {
    x: hit.point.x,
    y: 0,
    z: hit.point.z,
  };

  const snappedX = snapToGrid(hit.point.x);
  const snappedZ = snapToGrid(hit.point.z);
  marker.visible = true;
  marker.position.set(snappedX, 0.025, snappedZ);

  if (!selectedObjectId) {
    status.textContent = `Ground hit: x ${snappedX.toFixed(2)}, z ${snappedZ.toFixed(2)}`;
  }
}

function updatePointer(event) {
  const hit = getGroundHit(event);
  updateGroundMarker(hit);

  const selectedMesh = selection.getSelectedMesh();

  if (!isDraggingObject || !selectedObjectId || !selectedMesh || !hit) {
    return;
  }

  const object = getObjectById(selectedObjectId);

  if (!object) {
    return;
  }

  const nextX = snapToGrid(hit.point.x + dragOffset.x);
  const nextZ = snapToGrid(hit.point.z + dragOffset.z);

  object.position.x = nextX;
  object.position.z = nextZ;
  selectedMesh.position.set(nextX, object.position.y, nextZ);
  selection.updateSelectedMeshBounds();
  propertiesPanel.update();
  status.textContent = `Moving ${object.id}: x ${nextX.toFixed(2)}, z ${nextZ.toFixed(2)}`;
}

function getObjectHit(event) {
  updateRaycaster(event);
  const hits = raycaster.intersectObjects(objectLayer.children, true);
  return hits.find((hit) => hit.object.userData.objectId) ?? null;
}

function onPointerDown(event) {
  contextMenuController.hide();

  if (event.button !== 0) {
    return;
  }

  if (selection.isUsingTransformControls()) {
    return;
  }

  const objectHit = getObjectHit(event);

  if (!objectHit) {
    selectObject(null);
    return;
  }

  const objectId = objectHit.object.userData.objectId;
  const object = getObjectById(objectId);
  const groundHit = getGroundHit(event);

  if (!object || !groundHit) {
    return;
  }

  event.preventDefault();
  selectObject(objectId);
  controls.enabled = false;
  isDraggingObject = true;
  dragOffset = {
    x: object.position.x - groundHit.point.x,
    z: object.position.z - groundHit.point.z,
  };
}

function onPointerUp() {
  if (!isDraggingObject) {
    return;
  }

  isDraggingObject = false;
  controls.enabled = true;
}

renderer.domElement.addEventListener('pointermove', updatePointer);
renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
window.addEventListener('pointerup', onPointerUp);

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
