import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { catalog, createObjectMesh } from './catalog/index.js';
import {
  addObject,
  duplicateObject,
  getObjectById,
  loadState,
  removeObject,
  resetState,
  serializeState,
  state,
} from './state/store.js';

const app = document.getElementById('app');
const status = document.getElementById('status');
const contextMenu = document.getElementById('context-menu');
const newSceneButton = document.getElementById('new-scene');
const saveJsonButton = document.getElementById('save-json');
const loadJsonButton = document.getElementById('load-json');
const loadJsonInput = document.getElementById('load-json-input');
const noSelection = document.getElementById('no-selection');
const propertiesForm = document.getElementById('properties-form');
const propType = document.getElementById('prop-type');
const propX = document.getElementById('prop-x');
const propZ = document.getElementById('prop-z');
const propY = document.getElementById('prop-y');
const propRotation = document.getElementById('prop-rotation');
const propWidth = document.getElementById('prop-width');
const propHeight = document.getElementById('prop-height');
const propDepth = document.getElementById('prop-depth');
const propDepthLabel = document.getElementById('prop-depth-label');
const propDeckDepthRow = document.getElementById('prop-deck-depth-row');
const propDeckDepth = document.getElementById('prop-deck-depth');
const moveToolButton = document.getElementById('move-tool');
const rotateToolButton = document.getElementById('rotate-tool');
const rotateSelectedButton = document.getElementById('rotate-selected');
const duplicateSelectedButton = document.getElementById('duplicate-selected');
const deleteSelectedButton = document.getElementById('delete-selected');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e6);
scene.fog = new THREE.Fog(0x87b8e6, 35, 90);

const camera = new THREE.PerspectiveCamera(60, app.clientWidth / app.clientHeight, 0.1, 300);
camera.position.set(12, 12, 12);

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

const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(10, 18, 8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -25;
sunLight.shadow.camera.right = 25;
sunLight.shadow.camera.top = 25;
sunLight.shadow.camera.bottom = -25;
scene.add(sunLight);

const grid = new THREE.GridHelper(100, 100, 0x94a3b8, 0x475569);
grid.position.y = 0.001;
scene.add(grid);

const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  transparent: true,
  opacity: 0.15,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.name = 'ground';
scene.add(ground);

const axes = new THREE.AxesHelper(2);
scene.add(axes);

const objectLayer = new THREE.Group();
objectLayer.name = 'object-layer';
scene.add(objectLayer);

const marker = new THREE.Mesh(
  new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24),
  new THREE.MeshStandardMaterial({ color: 0xf97316 })
);
marker.position.y = 0.025;
marker.visible = false;
scene.add(marker);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const objectMeshes = new Map();
const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xf97316);
selectionHelper.visible = false;
scene.add(selectionHelper);

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode('translate');
transformControls.setTranslationSnap(state.scene.gridSize);
transformControls.setRotationSnap(Math.PI / 2);
scene.add(transformControls.getHelper());

function simplifyTransformGizmo() {
  const helper = transformControls.getHelper();
  const mode = transformControls.getMode();
  const hiddenTranslateHandles = new Set(['XY', 'YZ', 'XZ', 'XYZ', 'XYZE', 'E']);

  helper.traverse((child) => {
    if (!child.name) {
      return;
    }

    if (mode === 'translate' && hiddenTranslateHandles.has(child.name)) {
      child.visible = false;
    }
  });
}

simplifyTransformGizmo();

let lastGroundHit = { x: 0, y: 0, z: 0 };
let contextSpawnPosition = null;
let selectedObjectId = null;
let selectedMesh = null;
let isDraggingObject = false;
let dragOffset = { x: 0, z: 0 };

function snapToGrid(value) {
  const gridSize = state.scene.gridSize;
  return Math.round(value / gridSize) * gridSize;
}

function renderObjects() {
  objectLayer.clear();
  objectMeshes.clear();

  for (const object of state.objects) {
    const mesh = createObjectMesh(object);
    objectLayer.add(mesh);
    objectMeshes.set(object.id, mesh);
  }

  updateSelectionHelper();
}

function updateSelectionHelper() {
  selectedMesh = selectedObjectId ? objectMeshes.get(selectedObjectId) ?? null : null;
  selectionHelper.visible = Boolean(selectedMesh);

  if (selectedMesh) {
    selectionHelper.setFromObject(selectedMesh);
    transformControls.attach(selectedMesh);
  } else {
    transformControls.detach();
  }
}

function selectObject(objectId) {
  selectedObjectId = objectId;
  updateSelectionHelper();
  updatePropertiesPanel();

  if (objectId) {
    status.textContent = `Selected ${objectId}`;
  } else {
    isDraggingObject = false;
    controls.enabled = true;
    status.textContent = 'No selection';
  }
}

function updatePropertiesPanel() {
  const object = selectedObjectId ? getObjectById(selectedObjectId) : null;

  noSelection.hidden = Boolean(object);
  propertiesForm.hidden = !object;

  if (!object) {
    return;
  }

  propType.value = catalog[object.type]?.label ?? object.type;
  propX.value = object.position.x.toFixed(2);
  propZ.value = object.position.z.toFixed(2);
  propY.value = object.position.y.toFixed(2);
  propRotation.value = THREE.MathUtils.radToDeg(object.rotation.y).toFixed(0);
  propWidth.value = object.params.width;
  propHeight.value = object.params.height;

  if (object.type === 'quarterPipe') {
    propDepthLabel.textContent = 'Radius';
    propDepth.dataset.prop = 'params.radius';
    propDepth.value = object.params.radius ?? object.params.depth ?? 2;
    propDeckDepthRow.hidden = false;
    propDeckDepth.value = object.params.deckDepth ?? 0.8;
  } else {
    propDepthLabel.textContent = 'Depth';
    propDepth.dataset.prop = 'params.depth';
    propDepth.value = object.params.depth;
    propDeckDepthRow.hidden = true;
  }
}

function applyPropertyChange(input) {
  const object = selectedObjectId ? getObjectById(selectedObjectId) : null;
  const value = Number(input.value);

  if (!object || !Number.isFinite(value)) {
    return;
  }

  if (input.dataset.prop === 'position.x') {
    object.position.x = snapToGrid(value);
  } else if (input.dataset.prop === 'position.z') {
    object.position.z = snapToGrid(value);
  } else if (input.dataset.prop === 'position.y') {
    object.position.y = value;
  } else if (input.dataset.prop === 'rotation.y') {
    object.rotation.y = THREE.MathUtils.degToRad(value);
  } else if (input.dataset.prop === 'params.width') {
    object.params.width = Math.max(0.1, value);
  } else if (input.dataset.prop === 'params.height') {
    object.params.height = Math.max(0.1, value);
  } else if (input.dataset.prop === 'params.depth') {
    object.params.depth = Math.max(0.1, value);
  } else if (input.dataset.prop === 'params.radius') {
    object.params.radius = Math.max(0.1, value);
    delete object.params.depth;
  } else if (input.dataset.prop === 'params.deckDepth') {
    object.params.deckDepth = Math.max(0, value);
  }

  renderObjects();
  updatePropertiesPanel();
  status.textContent = `Updated ${object.id}`;
}

function rotateSelected() {
  const object = selectedObjectId ? getObjectById(selectedObjectId) : null;

  if (!object) {
    return;
  }

  object.rotation.y += Math.PI / 2;
  renderObjects();
  updatePropertiesPanel();
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

  selectedObjectId = null;
  renderObjects();
  updatePropertiesPanel();
  status.textContent = `Deleted ${removedObject.id}`;
}

function duplicateSelected() {
  if (!selectedObjectId) {
    return;
  }

  const copy = duplicateObject(selectedObjectId, {
    x: state.scene.gridSize,
    z: state.scene.gridSize,
  });

  if (!copy) {
    return;
  }

  renderObjects();
  selectObject(copy.id);
  status.textContent = `Duplicated ${copy.id}`;
}

function setTransformMode(mode) {
  transformControls.setMode(mode);

  if (mode === 'rotate') {
    transformControls.showX = false;
    transformControls.showY = true;
    transformControls.showZ = false;
  } else {
    transformControls.showX = true;
    transformControls.showY = true;
    transformControls.showZ = true;
  }

  simplifyTransformGizmo();
  status.textContent = `${mode === 'rotate' ? 'Rotate' : 'Move'} tool active`;
}

function syncSelectedObjectFromMesh() {
  const object = selectedObjectId ? getObjectById(selectedObjectId) : null;

  if (!object || !selectedMesh) {
    return;
  }

  object.position.x = selectedMesh.position.x;
  object.position.y = selectedMesh.position.y;
  object.position.z = selectedMesh.position.z;
  object.rotation.x = selectedMesh.rotation.x;
  object.rotation.y = selectedMesh.rotation.y;
  object.rotation.z = selectedMesh.rotation.z;

  selectionHelper.setFromObject(selectedMesh);
  updatePropertiesPanel();
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

function showContextMenu(event, position) {
  contextSpawnPosition = position;
  contextMenu.hidden = false;
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
}

function hideContextMenu() {
  contextMenu.hidden = true;
  contextSpawnPosition = null;
}

function saveJson() {
  const blob = new Blob([serializeState()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'skate-park.json';
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Saved JSON';
}

function resetScene() {
  const shouldReset = state.objects.length === 0 || window.confirm('Clear current scene?');

  if (!shouldReset) {
    return;
  }

  resetState();
  selectObject(null);
  renderObjects();
  updatePropertiesPanel();
  status.textContent = 'New scene';
}

async function loadJsonFile(file) {
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const snapshot = JSON.parse(text);
    loadState(snapshot);
    selectObject(null);
    renderObjects();
    updatePropertiesPanel();
    status.textContent = `Loaded ${state.objects.length} objects`;
  } catch (error) {
    console.error(error);
    status.textContent = 'Could not load JSON';
    window.alert('Could not load JSON file.');
  } finally {
    loadJsonInput.value = '';
  }
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
  selectionHelper.setFromObject(selectedMesh);
  updatePropertiesPanel();
  status.textContent = `Moving ${object.id}: x ${nextX.toFixed(2)}, z ${nextZ.toFixed(2)}`;
}

function getObjectHit(event) {
  updateRaycaster(event);
  const hits = raycaster.intersectObjects(objectLayer.children, true);
  return hits.find((hit) => hit.object.userData.objectId) ?? null;
}

function isUsingTransformControls() {
  return Boolean(selectedObjectId && transformControls.axis);
}

function onPointerDown(event) {
  hideContextMenu();

  if (event.button !== 0) {
    return;
  }

  if (isUsingTransformControls()) {
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
renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const hit = getGroundHit(event);

  if (!hit) {
    hideContextMenu();
    return;
  }

  showContextMenu(event, {
    x: hit.point.x,
    y: 0,
    z: hit.point.z,
  });
});
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('click', (event) => {
  if (!contextMenu.contains(event.target)) {
    hideContextMenu();
  }
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideContextMenu();
  }
});

transformControls.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value;
});

transformControls.addEventListener('objectChange', () => {
  syncSelectedObjectFromMesh();
});

document.querySelectorAll('[data-add-object]').forEach((button) => {
  button.addEventListener('click', () => {
    spawnObject(button.dataset.addObject);
  });
});

document.querySelectorAll('[data-context-add]').forEach((button) => {
  button.addEventListener('click', () => {
    spawnObject(button.dataset.contextAdd, contextSpawnPosition ?? lastGroundHit);
    hideContextMenu();
  });
});

document.querySelectorAll('[data-prop]').forEach((input) => {
  input.addEventListener('change', () => {
    applyPropertyChange(input);
  });
});

newSceneButton.addEventListener('click', resetScene);
saveJsonButton.addEventListener('click', saveJson);
loadJsonButton.addEventListener('click', () => loadJsonInput.click());
loadJsonInput.addEventListener('change', () => loadJsonFile(loadJsonInput.files[0]));

moveToolButton.addEventListener('click', () => setTransformMode('translate'));
rotateToolButton.addEventListener('click', () => setTransformMode('rotate'));
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
    setTransformMode('translate');
  } else if (event.key === 'e' || event.key === 'E') {
    setTransformMode('rotate');
  } else if (event.key === 'r' || event.key === 'R') {
    rotateSelected();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelected();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    duplicateSelected();
  }
});

updatePropertiesPanel();

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
