import * as THREE from 'three';

const LONG_PRESS_MS = 550;

export function createDragging({
  scene,
  renderer,
  camera,
  raycast,
  controls,
  selection,
  objectMeshes,
  isObjectLocked = () => false,
  selectObject,
  selectObjects,
  getSelectedId,
  getObjectById,
  snapToGrid,
  onBeforeChange,
  updateProperties,
  hideContextMenu,
  setStatus,
  onGroundMove,
  onPrimaryClick,
  onLongPressEmpty,
}) {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xf97316 })
  );
  marker.position.y = 0.025;
  marker.visible = false;
  scene.add(marker);

  const marquee = document.createElement('div');
  marquee.className = 'marquee-select';
  marquee.hidden = true;
  document.body.appendChild(marquee);

  let lastGroundHit = { x: 0, y: 0, z: 0 };
  let isDraggingObject = false;
  let dragOffset = { x: 0, z: 0 };
  let marqueeStart = null;
  let marqueeCurrent = null;
  let marqueeAdditive = false;
  let longPressTimer = null;
  let longPressStart = null;
  let touchEmptyStart = null;
  let touchObjectId = null;

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

  function setMarqueeBox() {
    if (!marqueeStart || !marqueeCurrent) {
      return;
    }

    const left = Math.min(marqueeStart.x, marqueeCurrent.x);
    const top = Math.min(marqueeStart.y, marqueeCurrent.y);
    const width = Math.abs(marqueeStart.x - marqueeCurrent.x);
    const height = Math.abs(marqueeStart.y - marqueeCurrent.y);

    marquee.style.left = `${left}px`;
    marquee.style.top = `${top}px`;
    marquee.style.width = `${width}px`;
    marquee.style.height = `${height}px`;
    marquee.hidden = width < 4 && height < 4;
  }

  function isPointInMarquee(point) {
    const left = Math.min(marqueeStart.x, marqueeCurrent.x);
    const right = Math.max(marqueeStart.x, marqueeCurrent.x);
    const top = Math.min(marqueeStart.y, marqueeCurrent.y);
    const bottom = Math.max(marqueeStart.y, marqueeCurrent.y);

    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  function getMarqueeObjectIds() {
    const rect = renderer.domElement.getBoundingClientRect();
    const ids = [];

    for (const [id, mesh] of objectMeshes) {
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const projected = center.project(camera);
      const point = {
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((-projected.y + 1) / 2) * rect.height,
      };

      if (!isObjectLocked(id) && isPointInMarquee(point)) {
        ids.push(id);
      }
    }

    return ids;
  }

  function cancelLongPress() {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    longPressStart = null;
    touchObjectId = null;
  }

  function updatePointer(event) {
    if (longPressStart) {
      const distance = Math.hypot(event.clientX - longPressStart.x, event.clientY - longPressStart.y);

      if (distance > 10) {
        cancelLongPress();
        touchEmptyStart = null;
      }
    }

    const hit = raycast.getGroundHit(event);
    updateGroundMarker(hit);
    onGroundMove?.(hit);

    if (marqueeStart) {
      marqueeCurrent = { x: event.clientX, y: event.clientY };
      setMarqueeBox();
      return;
    }

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

    const groundHit = raycast.getGroundHit(event);

    if (onPrimaryClick?.(groundHit)) {
      return;
    }

    if (selection.isUsingTransformControls()) {
      return;
    }

    let objectHit = raycast.getObjectHit(event);

    if (objectHit && isObjectLocked(objectHit.object.userData.objectId)) {
      objectHit = null;
    }

    if (!objectHit) {
      if (event.pointerType === 'touch') {
        touchEmptyStart = { x: event.clientX, y: event.clientY };
        longPressStart = { x: event.clientX, y: event.clientY };
        longPressTimer = window.setTimeout(() => {
          longPressTimer = null;
          longPressStart = null;
          onLongPressEmpty?.();
        }, LONG_PRESS_MS);
        return;
      }

      marqueeStart = { x: event.clientX, y: event.clientY };
      marqueeCurrent = { ...marqueeStart };
      marqueeAdditive = event.shiftKey;
      setMarqueeBox();
      return;
    }

    const objectId = objectHit.object.userData.objectId;
    const object = getObjectById(objectId);

    if (!object || !groundHit) {
      return;
    }

    if (event.pointerType === 'touch') {
      touchObjectId = objectId;
      longPressStart = { x: event.clientX, y: event.clientY };
      longPressTimer = window.setTimeout(() => {
        const id = touchObjectId;
        longPressTimer = null;
        longPressStart = null;
        touchObjectId = null;

        if (id) {
          selectObject(id, { editGroupItem: true });
        }
      }, LONG_PRESS_MS);
      return;
    }

    event.preventDefault();
    selectObject(objectId, {
      toggle: event.shiftKey,
      editGroupItem: event.detail >= 2,
    });

    const selectedIds = selection.getSelectedIds();

    if (event.detail >= 2 || event.shiftKey || selectedIds.length > 1 || !selectedIds.includes(objectId)) {
      return;
    }

    onBeforeChange?.();
    controls.enabled = false;
    isDraggingObject = true;
    dragOffset = {
      x: object.position.x - groundHit.point.x,
      z: object.position.z - groundHit.point.z,
    };
  }

  function onDoubleClick(event) {
    const objectHit = raycast.getObjectHit(event);

    if (!objectHit) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const objectId = objectHit.object.userData.objectId;

    if (isObjectLocked(objectId)) {
      return;
    }

    selectObject(objectId, { editGroupItem: true });
  }

  function onPointerUp(event) {
    const touchTapStart = touchEmptyStart;
    touchEmptyStart = null;
    cancelLongPress();

    if (touchTapStart) {
      const distance = Math.hypot(event.clientX - touchTapStart.x, event.clientY - touchTapStart.y);

      if (distance <= 10) {
        selectObject(null);
      }

      return;
    }

    if (marqueeStart && marqueeCurrent) {
      const width = Math.abs(marqueeStart.x - marqueeCurrent.x);
      const height = Math.abs(marqueeStart.y - marqueeCurrent.y);

      marquee.hidden = true;

      if (width < 4 && height < 4) {
        selectObject(null);
      } else {
        const ids = getMarqueeObjectIds();
        const nextIds = marqueeAdditive
          ? [...new Set([...selection.getSelectedIds(), ...ids])]
          : ids;
        selectObjects(nextIds);
      }

      marqueeStart = null;
      marqueeCurrent = null;
      marqueeAdditive = false;
      return;
    }

    if (!isDraggingObject) {
      return;
    }

    isDraggingObject = false;
    controls.enabled = true;
  }

  renderer.domElement.addEventListener('pointermove', updatePointer);
  renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
  renderer.domElement.addEventListener('dblclick', onDoubleClick, { capture: true });
  window.addEventListener('pointerup', onPointerUp);

  return {
    getLastGroundHit: () => lastGroundHit,
    stopDragging: () => {
      isDraggingObject = false;
      controls.enabled = true;
      marquee.hidden = true;
      marqueeStart = null;
      marqueeCurrent = null;
      touchEmptyStart = null;
      cancelLongPress();
    },
  };
}
