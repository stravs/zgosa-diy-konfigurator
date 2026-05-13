import * as THREE from 'three';

export function createDragging({
  scene,
  renderer,
  raycast,
  controls,
  selection,
  selectObject,
  getSelectedId,
  getObjectById,
  snapToGrid,
  updateProperties,
  hideContextMenu,
  setStatus,
}) {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xf97316 })
  );
  marker.position.y = 0.025;
  marker.visible = false;
  scene.add(marker);

  let lastGroundHit = { x: 0, y: 0, z: 0 };
  let isDraggingObject = false;
  let dragOffset = { x: 0, z: 0 };

  function updateGroundMarker(hit) {
    if (!hit) {
      marker.visible = false;
      setStatus('Ground hit: —');
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

    if (!getSelectedId()) {
      setStatus(`Ground hit: x ${snappedX.toFixed(2)}, z ${snappedZ.toFixed(2)}`);
    }
  }

  function updatePointer(event) {
    const hit = raycast.getGroundHit(event);
    updateGroundMarker(hit);

    const selectedObjectId = getSelectedId();
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
    updateProperties();
    setStatus(`Moving ${object.id}: x ${nextX.toFixed(2)}, z ${nextZ.toFixed(2)}`);
  }

  function onPointerDown(event) {
    hideContextMenu();

    if (event.button !== 0) {
      return;
    }

    if (selection.isUsingTransformControls()) {
      return;
    }

    const objectHit = raycast.getObjectHit(event);

    if (!objectHit) {
      selectObject(null);
      return;
    }

    const objectId = objectHit.object.userData.objectId;
    const object = getObjectById(objectId);
    const groundHit = raycast.getGroundHit(event);

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

  return {
    getLastGroundHit: () => lastGroundHit,
    stopDragging: () => {
      isDraggingObject = false;
      controls.enabled = true;
    },
  };
}
