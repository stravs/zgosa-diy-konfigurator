import * as THREE from 'three';
import { createObjectMesh } from '../catalog/index.js';
import { disposeObject3D } from '../core/dispose.js';

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
  if (type === 'flatHip') return { height: 0.8, length: 2.0, topSize: 0, degrees: 90 };
  if (type === 'rail') return { height: 0.7, length: 3.0, railRadius: 0.05 };
  if (type === 'stairs') return { width: 2.4, height: 0.18, stepCount: 5, treadDepth: 0.35 };
  if (type === 'skater') return { height: 1.8 };
  return {};
}

function getHitWorldNormal(hit) {
  if (!hit?.face) {
    return new THREE.Vector3(0, 1, 0);
  }

  const normal = hit.face.normal.clone();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return normal.applyMatrix3(normalMatrix).normalize();
}

function getPlacementRotation(hit) {
  const normal = getHitWorldNormal(hit);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal
  );
  return new THREE.Euler().setFromQuaternion(quaternion);
}

export function createPlacementController({
  scene,
  catalog,
  addObject,
  snapToGrid,
  history,
  renderObjects,
  selectObject,
  propertySheet,
  closeMobileDrawers,
  getLastGroundHit,
  setStatus,
  requestRender,
}) {
  let pendingObjectType = null;
  let previewMesh = null;

  function spawnObject(type, position = null, rotation = null) {
    if (!catalog[type]) {
      console.warn(`Unknown object type: ${type}`);
      return null;
    }

    const spawnPosition = position ?? getLastGroundHit?.() ?? { x: 0, y: 0, z: 0 };
    history.record();
    const object = addObject(type, {
      x: snapToGrid(spawnPosition.x),
      y: spawnPosition.y ?? 0,
      z: snapToGrid(spawnPosition.z),
    });

    if (rotation) {
      object.rotation.x = rotation.x;
      object.rotation.y = rotation.y;
      object.rotation.z = rotation.z;
    }

    renderObjects();
    selectObject(object.id);
    setStatus(`Added ${catalog[type].label}`);
    return object;
  }

  function clearPlacementPreview() {
    if (previewMesh) {
      scene.remove(previewMesh);
      disposeObject3D(previewMesh);
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
    setStatus(`Placing ${catalog[type].label}. Left click to place.`);
    requestRender();
  }

  function updatePlacementPreview(hit) {
    if (!previewMesh || !hit) {
      return;
    }

    previewMesh.visible = true;
    previewMesh.position.set(
      snapToGrid(hit.point.x),
      hit.point.y,
      snapToGrid(hit.point.z)
    );
    previewMesh.rotation.copy(getPlacementRotation(hit));
    requestRender();
  }

  function placePendingObject(hit) {
    if (!pendingObjectType || !hit) {
      return false;
    }

    spawnObject(pendingObjectType, {
      x: hit.point.x,
      y: hit.point.y,
      z: hit.point.z,
    }, getPlacementRotation(hit));
    clearPlacementPreview();
    return true;
  }

  return {
    startPlacement,
    spawnObject,
    updatePlacementPreview,
    placePendingObject,
    clearPlacementPreview,
  };
}
