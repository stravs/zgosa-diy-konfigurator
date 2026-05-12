import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog, createObjectMesh } from './catalog/index.js';
import { addObject, getObjectById, state } from './state/store.js';

const app = document.getElementById('app');
const status = document.getElementById('status');

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

let lastGroundHit = { x: 0, y: 0, z: 0 };
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
  }
}

function selectObject(objectId) {
  selectedObjectId = objectId;
  updateSelectionHelper();

  if (objectId) {
    status.textContent = `Selected ${objectId}`;
  }
}

function spawnObject(type) {
  if (!catalog[type]) {
    console.warn(`Unknown object type: ${type}`);
    return;
  }

  addObject(type, {
    x: snapToGrid(lastGroundHit.x),
    y: 0,
    z: snapToGrid(lastGroundHit.z),
  });

  renderObjects();
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
  status.textContent = `Moving ${object.id}: x ${nextX.toFixed(2)}, z ${nextZ.toFixed(2)}`;
}

function getObjectHit(event) {
  updateRaycaster(event);
  const hits = raycaster.intersectObjects(objectLayer.children, true);
  return hits.find((hit) => hit.object.userData.objectId) ?? null;
}

function onPointerDown(event) {
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
