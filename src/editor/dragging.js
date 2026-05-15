import * as THREE from 'three';

const LONG_PRESS_MS = 550;
const TAP_MOVE_PX = 10;
const MARQUEE_MIN_PX = 4;
const SURFACE_MIN_NORMAL_Y = 0.25;
const ROTATE_RAD_PER_PX = Math.PI / 180;

export function createDragging({
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
  canRotateObject = () => false,
  canToggleSelect = () => false,
  onObjectDragEnd,
  updateProperties,
  setStatus,
  onGroundMove,
  onPrimaryClick,
  onLongPressEmpty,
  onSceneTap,
  onLongPressObject,
  onDoubleClickObject,
}) {

  const marquee = document.createElement('div');
  marquee.className = 'marquee-select';
  marquee.hidden = true;
  document.body.appendChild(marquee);

  let lastGroundHit = { x: 0, y: 0, z: 0 };
  let isDraggingObject = false;
  let dragObjectId = null;
  let dragOffset = { x: 0, z: 0 };
  let dragStartPoint = null;
  let dragYaw = 0;
  let hasRecordedDragChange = false;
  let isRotatingObject = false;
  let rotateStartPoint = null;
  let rotateSnapshots = [];
  let hasRecordedRotateChange = false;
  let activePointerId = null;
  let marqueeStart = null;
  let marqueeCurrent = null;
  let marqueeAdditive = false;
  let longPressTimer = null;
  let longPressStart = null;
  let touchEmptyStart = null;
  let touchObjectId = null;
  const activeTouchPointers = new Set();
  const dragRaycaster = new THREE.Raycaster();

  function consumeEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function getPointerDistance(start, event) {
    return start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : 0;
  }

  function getMoveThreshold(start) {
    return start?.pointerType === 'touch' ? TAP_MOVE_PX : 0;
  }

  function capturePointer(event) {
    activePointerId = event.pointerId;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function releasePointer(event) {
    if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (activePointerId === event.pointerId) {
      activePointerId = null;
    }
  }

  function releaseActivePointer() {
    if (activePointerId !== null && renderer.domElement.hasPointerCapture?.(activePointerId)) {
      renderer.domElement.releasePointerCapture(activePointerId);
    }

    activePointerId = null;
  }

  function isActivePointer(event) {
    return activePointerId === null || event.pointerId === activePointerId;
  }

  function resetDragState() {
    isDraggingObject = false;
    dragObjectId = null;
    dragStartPoint = null;
    hasRecordedDragChange = false;
  }

  function resetRotateState() {
    isRotatingObject = false;
    rotateStartPoint = null;
    rotateSnapshots = [];
    hasRecordedRotateChange = false;
  }

  function resetMarqueeState() {
    marquee.hidden = true;
    marqueeStart = null;
    marqueeCurrent = null;
    marqueeAdditive = false;
  }

  function resetTouchState() {
    touchEmptyStart = null;
    activeTouchPointers.clear();
    cancelLongPress();
  }

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

  function getHitWorldNormal(hit) {
    if (!hit?.face) {
      return new THREE.Vector3(0, 1, 0);
    }

    const normal = hit.face.normal.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    return normal.applyMatrix3(normalMatrix).normalize();
  }

  function getSurfaceRotation(normal, yaw = 0) {
    const surfaceQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );
    const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return new THREE.Euler().setFromQuaternion(surfaceQuaternion.multiply(yawQuaternion));
  }

  function getMoveHit(event, object) {
    const surfaceHit = raycast.getPlacementHit(event, { excludeIds: [object.id] });

    if (surfaceHit) {
      const normal = getHitWorldNormal(surfaceHit);

      if (normal.y > SURFACE_MIN_NORMAL_Y) {
        return {
          point: surfaceHit.point,
          normal,
        };
      }
    }

    const fallbackPoint = getFallbackPlanePoint(event, object.position.y);
    return fallbackPoint ? { point: fallbackPoint, normal: new THREE.Vector3(0, 1, 0) } : null;
  }

  function updateGroundMarker(hit) {
    if (!hit) {
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
    marquee.hidden = width < MARQUEE_MIN_PX && height < MARQUEE_MIN_PX;
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

  function getSelectionCenter() {
    const box = new THREE.Box3();
    let hasBox = false;

    for (const id of selection.getSelectedIds()) {
      const mesh = objectMeshes.get(id);

      if (!mesh) {
        continue;
      }

      box.union(new THREE.Box3().setFromObject(mesh));
      hasBox = true;
    }

    return hasBox ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
  }

  function shouldWaitForGestureThreshold(start, event) {
    return getPointerDistance(start, event) <= getMoveThreshold(start);
  }

  function recordDragChangeIfNeeded() {
    if (hasRecordedDragChange) {
      return;
    }

    onBeforeChange?.();
    hasRecordedDragChange = true;
  }

  function recordRotateChangeIfNeeded() {
    if (hasRecordedRotateChange) {
      return;
    }

    onBeforeChange?.();
    hasRecordedRotateChange = true;
  }

  function updatePointer(event) {
    if ((isDraggingObject || isRotatingObject) && !isActivePointer(event)) {
      return;
    }

    if (event.pointerType === 'touch' && activeTouchPointers.size > 1) {
      cancelLongPress();
      touchEmptyStart = null;
      return;
    }

    if (longPressStart) {
      const distance = getPointerDistance(longPressStart, event);

      if (distance > TAP_MOVE_PX) {
        cancelLongPress();
        touchEmptyStart = null;
      }
    }

    const hit = raycast.getGroundHit(event);
    const placementHit = raycast.getPlacementHit(event);
    updateGroundMarker(hit);
    onGroundMove?.(placementHit);

    if (isRotatingObject && rotateStartPoint) {
      consumeEvent(event);

      if (shouldWaitForGestureThreshold(rotateStartPoint, event)) {
        return;
      }

      recordRotateChangeIfNeeded();

      const delta = event.clientX - rotateStartPoint.x;
      const angle = delta * ROTATE_RAD_PER_PX;
      const center = rotateStartPoint.center;

      for (const snapshot of rotateSnapshots) {
        const object = getObjectById(snapshot.id);
        const mesh = objectMeshes.get(snapshot.id);

        if (!object || !mesh) {
          continue;
        }

        const offset = snapshot.position.clone().sub(center);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        const nextPosition = center.clone().add(offset);

        object.position.x = nextPosition.x;
        object.position.z = nextPosition.z;
        object.rotation.y = snapshot.rotationY + angle;
        mesh.position.x = object.position.x;
        mesh.position.z = object.position.z;
        mesh.rotation.y = object.rotation.y;
      }

      selection.updateSelectedMeshBounds();
      updateProperties();
      setStatus(`Rotating ${rotateSnapshots.length} object${rotateSnapshots.length === 1 ? '' : 's'}`);
      return;
    }

    if (marqueeStart) {
      marqueeCurrent = { x: event.clientX, y: event.clientY };
      setMarqueeBox();
      return;
    }

    if (!isDraggingObject || !dragObjectId) {
      return;
    }

    const object = getObjectById(dragObjectId);
    const selectedMesh = objectMeshes.get(dragObjectId);
    const moveHit = object ? getMoveHit(event, object) : null;

    if (!object || !selectedMesh || !moveHit) {
      return;
    }

    consumeEvent(event);

    if (shouldWaitForGestureThreshold(dragStartPoint, event)) {
      return;
    }

    recordDragChangeIfNeeded();

    const nextX = moveHit.point.x + dragOffset.x;
    const nextZ = moveHit.point.z + dragOffset.z;
    const nextY = moveHit.point.y;
    const nextRotation = getSurfaceRotation(moveHit.normal, dragYaw);

    object.position.x = nextX;
    object.position.y = nextY;
    object.position.z = nextZ;
    object.rotation.x = nextRotation.x;
    object.rotation.y = nextRotation.y;
    object.rotation.z = nextRotation.z;
    selectedMesh.position.set(nextX, nextY, nextZ);
    selectedMesh.rotation.copy(nextRotation);
    selection.updateSelectedMeshBounds();
    updateProperties();
    setStatus(`Moving ${object.id}: x ${nextX.toFixed(2)}, z ${nextZ.toFixed(2)}`);
  }

  function startObjectRotate(event) {
    const ids = selection.getSelectedIds();

    if (ids.length === 0) {
      return false;
    }

    consumeEvent(event);

    controls.enabled = false;
    isRotatingObject = true;
    hasRecordedRotateChange = false;
    capturePointer(event);
    rotateStartPoint = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      center: getSelectionCenter(),
    };
    rotateSnapshots = ids.map((id) => {
      const object = getObjectById(id);
      return object ? {
        id,
        position: new THREE.Vector3(object.position.x, object.position.y, object.position.z),
        rotationY: object.rotation.y,
      } : null;
    }).filter(Boolean);
    return true;
  }

  function startObjectDrag(event, object) {
    const moveHit = getMoveHit(event, object);

    if (!moveHit) {
      return false;
    }

    consumeEvent(event);

    controls.enabled = false;
    isDraggingObject = true;
    dragObjectId = object.id;
    hasRecordedDragChange = false;
    dragStartPoint = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
    capturePointer(event);
    dragYaw = object.rotation.y;
    dragOffset = {
      x: object.position.x - moveHit.point.x,
      z: object.position.z - moveHit.point.z,
    };
    return true;
  }

  function onPointerDown(event) {
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

    const placementHit = raycast.getPlacementHit(event);

    if (onPrimaryClick?.(placementHit)) {
      consumeEvent(event);
      return;
    }

    if (canToggleSelect()) {
      let objectHit = raycast.getObjectHit(event);

      if (objectHit && isObjectLocked(objectHit.object.userData.objectId)) {
        objectHit = null;
      }

      if (objectHit) {
        consumeEvent(event);
        selectObject(objectHit.object.userData.objectId, { toggle: true, editGroupItem: true });
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
          touchEmptyStart = null;
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

      if (selectedIds.includes(objectId) && canRotateObject()) {
        cancelLongPress();
        startObjectRotate(event);
        return;
      }

      if (selectedIds.length === 1 && selectedIds.includes(objectId) && canDragObject()) {
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

    consumeEvent(event);
    selectObject(objectId, {
      toggle: event.shiftKey,
      editGroupItem: event.detail >= 2,
    });

    const selectedIds = selection.getSelectedIds();

    if (event.detail >= 2 || event.shiftKey || !selectedIds.includes(objectId)) {
      return;
    }

    if (canRotateObject()) {
      startObjectRotate(event);
      return;
    }

    if (selectedIds.length > 1 || !canDragObject()) {
      return;
    }

    startObjectDrag(event, object);
  }

  function onDoubleClick(event) {
    const objectHit = raycast.getObjectHit(event);

    if (!objectHit) {
      return;
    }

    consumeEvent(event);
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

    if ((isDraggingObject || isRotatingObject) && !isActivePointer(event)) {
      return;
    }

    const touchTapStart = touchEmptyStart;
    touchEmptyStart = null;
    cancelLongPress();

    if (touchTapStart) {
      const distance = getPointerDistance(touchTapStart, event);

      if (distance <= TAP_MOVE_PX) {
        onSceneTap?.();
        selectObject(null);
      }

      return;
    }

    if (marqueeStart && marqueeCurrent) {
      const width = Math.abs(marqueeStart.x - marqueeCurrent.x);
      const height = Math.abs(marqueeStart.y - marqueeCurrent.y);

      marquee.hidden = true;

      if (width < MARQUEE_MIN_PX && height < MARQUEE_MIN_PX) {
        selectObject(null);
      } else {
        const ids = getMarqueeObjectIds();
        const nextIds = marqueeAdditive
          ? [...new Set([...selection.getSelectedIds(), ...ids])]
          : ids;
        selectObjects(nextIds);
      }

      resetMarqueeState();
      return;
    }

    if (isRotatingObject) {
      const wasTap = rotateStartPoint
        && rotateStartPoint.pointerType === 'touch'
        && getPointerDistance(rotateStartPoint, event) <= TAP_MOVE_PX;

      resetRotateState();
      controls.enabled = true;
      releasePointer(event);
      onObjectDragEnd?.();

      if (wasTap && canRotateObject()) {
        onSceneTap?.();
        selectObject(null);
      }

      return;
    }

    if (!isDraggingObject) {
      return;
    }

    const wasTap = dragStartPoint
      && dragStartPoint.pointerType === 'touch'
      && getPointerDistance(dragStartPoint, event) <= TAP_MOVE_PX;

    resetDragState();
    controls.enabled = true;
    releasePointer(event);
    onObjectDragEnd?.();

    if (wasTap && canDragObject()) {
      onSceneTap?.();
      selectObject(null);
    }
  }

  renderer.domElement.addEventListener('pointermove', updatePointer);
  renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
  renderer.domElement.addEventListener('dblclick', onDoubleClick, true);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return {
    getLastGroundHit: () => lastGroundHit,
    stopDragging: () => {
      resetDragState();
      resetRotateState();
      resetMarqueeState();
      releaseActivePointer();
      controls.enabled = true;
      resetTouchState();
    },
    destroy: () => {
      renderer.domElement.removeEventListener('pointermove', updatePointer);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick, true);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      resetDragState();
      resetRotateState();
      releaseActivePointer();
      resetTouchState();
      marquee.remove();
    },
  };
}
