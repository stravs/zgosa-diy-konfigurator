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
  canDragObject = () => true,
  onObjectDragEnd,
  updateProperties,
  hideContextMenu,
  setStatus,
  onGroundMove,
  onPrimaryClick,
  onLongPressEmpty,
  onLongPressObject,
  onDoubleClickObject,
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
  let dragStartPoint = null;
  let marqueeStart = null;
  let marqueeCurrent = null;
  let marqueeAdditive = false;
  let longPressTimer = null;
  let longPressStart = null;
  let touchEmptyStart = null;
  let touchObjectId = null;
  const activeTouchPointers = new Set();
  const dragRaycaster = new THREE.Raycaster();

  function getPointerNdc(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    );
  }

  function getFallbackPlanePoint(event, y) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const point = new THREE.Vector3();
    dragRaycaster.setFromCamera(getPointerNdc(event), camera);
    return dragRaycaster.ray.intersectPlane(plane, point) ? point : null;
  }

  function getMovePoint(event, object) {
    const surfaceHit = raycast.getPlacementHit(event, { excludeIds: [object.id] });
    return surfaceHit?.point ?? getFallbackPlanePoint(event, object.position.y);
  }

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
    if (event.pointerType === 'touch' && activeTouchPointers.size > 1) {
      cancelLongPress();
      touchEmptyStart = null;
      return;
    }

    if (longPressStart) {
      const distance = Math.hypot(event.clientX - longPressStart.x, event.clientY - longPressStart.y);

      if (distance > 10) {
        cancelLongPress();
        touchEmptyStart = null;
      }
    }

    const hit = raycast.getGroundHit(event);
    const placementHit = raycast.getPlacementHit(event);
    updateGroundMarker(hit);
    onGroundMove?.(placementHit);

    if (marqueeStart) {
      marqueeCurrent = { x: event.clientX, y: event.clientY };
      setMarqueeBox();
      return;
    }

    const selectedObjectId = getSelectedId();
    const selectedMesh = selection.getSelectedMesh();

    if (!isDraggingObject || !selectedObjectId || !selectedMesh) {
      return;
    }

    const object = getObjectById(selectedObjectId);
    const movePoint = object ? getMovePoint(event, object) : null;

    if (!object || !movePoint) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const nextX = movePoint.x + dragOffset.x;
    const nextZ = movePoint.z + dragOffset.z;
    const nextY = movePoint.y;

    object.position.x = nextX;
    object.position.y = nextY;
    object.position.z = nextZ;
    selectedMesh.position.set(nextX, nextY, nextZ);
    selection.updateSelectedMeshBounds();
    updateProperties();
    setStatus(`Moving ${object.id}: x ${nextX.toFixed(2)}, z ${nextZ.toFixed(2)}`);
  }

  function startObjectDrag(event, object) {
    const movePoint = getMovePoint(event, object);

    if (!movePoint) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    onBeforeChange?.();
    controls.enabled = false;
    isDraggingObject = true;
    dragStartPoint = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
    renderer.domElement.setPointerCapture?.(event.pointerId);
    dragOffset = {
      x: object.position.x - movePoint.x,
      z: object.position.z - movePoint.z,
    };
    return true;
  }

  function onPointerDown(event) {
    hideContextMenu();

    if (event.pointerType === 'touch') {
      activeTouchPointers.add(event.pointerId);

      if (activeTouchPointers.size > 1) {
        cancelLongPress();
        touchEmptyStart = null;
        return;
      }
    }

    if (event.button !== 0) {
      return;
    }

    const groundHit = raycast.getGroundHit(event);
    const placementHit = raycast.getPlacementHit(event);

    if (onPrimaryClick?.(placementHit)) {
      return;
    }

    if (event.pointerType === 'touch' && canDragObject()) {
      const selectedIds = selection.getSelectedIds();
      const object = selectedIds.length === 1 ? getObjectById(selectedIds[0]) : null;

      if (object) {
        cancelLongPress();
        startObjectDrag(event, object);
        return;
      }
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

    if (!object) {
      return;
    }

    if (event.pointerType === 'touch') {
      const selectedIds = selection.getSelectedIds();

      if (selectedIds.length === 1 && selectedIds.includes(objectId) && canDragObject()) {
        event.preventDefault();
        cancelLongPress();
        startObjectDrag(event, object);
        return;
      }

      touchObjectId = objectId;
      longPressStart = { x: event.clientX, y: event.clientY };
      longPressTimer = window.setTimeout(() => {
        const id = touchObjectId;
        longPressTimer = null;
        longPressStart = null;
        touchObjectId = null;

        if (id) {
          onLongPressObject?.(id);
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

    if (event.detail >= 2 || event.shiftKey || selectedIds.length > 1 || !selectedIds.includes(objectId) || !canDragObject()) {
      return;
    }

    startObjectDrag(event, object);
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

    if (onDoubleClickObject) {
      onDoubleClickObject(objectId);
    } else {
      selectObject(objectId, { editGroupItem: true });
    }
  }

  function onPointerUp(event) {
    if (event.pointerType === 'touch') {
      activeTouchPointers.delete(event.pointerId);
    }

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

    const wasTap = dragStartPoint
      && dragStartPoint.pointerType === 'touch'
      && Math.hypot(event.clientX - dragStartPoint.x, event.clientY - dragStartPoint.y) <= 10;

    isDraggingObject = false;
    dragStartPoint = null;
    controls.enabled = true;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    onObjectDragEnd?.();

    if (wasTap && canDragObject()) {
      selectObject(null);
    }
  }

  renderer.domElement.addEventListener('pointermove', updatePointer);
  renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
  renderer.domElement.addEventListener('dblclick', onDoubleClick, { capture: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return {
    getLastGroundHit: () => lastGroundHit,
    stopDragging: () => {
      isDraggingObject = false;
      dragStartPoint = null;
      controls.enabled = true;
      marquee.hidden = true;
      marqueeStart = null;
      marqueeCurrent = null;
      touchEmptyStart = null;
      cancelLongPress();
    },
  };
}
