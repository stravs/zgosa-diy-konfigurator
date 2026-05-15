import * as THREE from 'three';

const LONG_PRESS_MS = 550;

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
  let dragOffset = { x: 0, z: 0 };
  let dragStartPoint = null;
  let dragYaw = 0;
  let isRotatingObject = false;
  let rotateStartPoint = null;
  let rotateSnapshots = [];
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

      if (normal.y > 0.25) {
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

    if (isRotatingObject && rotateStartPoint) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const delta = event.clientX - rotateStartPoint.x;
      const angle = delta * (Math.PI / 180);
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

    const selectedObjectId = getSelectedId();
    const selectedMesh = selection.getSelectedMesh();

    if (!isDraggingObject || !selectedObjectId || !selectedMesh) {
      return;
    }

    const object = getObjectById(selectedObjectId);
    const moveHit = object ? getMoveHit(event, object) : null;

    if (!object || !moveHit) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

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

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    onBeforeChange?.();
    controls.enabled = false;
    isRotatingObject = true;
    renderer.domElement.setPointerCapture?.(event.pointerId);
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

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    onBeforeChange?.();
    controls.enabled = false;
    isDraggingObject = true;
    dragStartPoint = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
    renderer.domElement.setPointerCapture?.(event.pointerId);
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

    const groundHit = raycast.getGroundHit(event);
    const placementHit = raycast.getPlacementHit(event);

    if (onPrimaryClick?.(placementHit)) {
      return;
    }

    if (event.pointerType === 'touch' && canToggleSelect()) {
      let objectHit = raycast.getObjectHit(event);

      if (objectHit && isObjectLocked(objectHit.object.userData.objectId)) {
        objectHit = null;
      }

      if (objectHit) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        selectObject(objectHit.object.userData.objectId, { toggle: true, editGroupItem: true });
        return;
      }
    }

    if (event.pointerType === 'touch' && canRotateObject() && selection.getSelectedIds().length > 0) {
      cancelLongPress();
      startObjectRotate(event);
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
        onSceneTap?.();
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

    if (isRotatingObject) {
      const wasTap = rotateStartPoint
        && rotateStartPoint.pointerType === 'touch'
        && Math.hypot(event.clientX - rotateStartPoint.x, event.clientY - rotateStartPoint.y) <= 10;

      isRotatingObject = false;
      rotateStartPoint = null;
      rotateSnapshots = [];
      controls.enabled = true;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
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
      && Math.hypot(event.clientX - dragStartPoint.x, event.clientY - dragStartPoint.y) <= 10;

    isDraggingObject = false;
    dragStartPoint = null;
    controls.enabled = true;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    onObjectDragEnd?.();

    if (wasTap && canDragObject()) {
      onSceneTap?.();
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
      isRotatingObject = false;
      dragStartPoint = null;
      rotateStartPoint = null;
      rotateSnapshots = [];
      controls.enabled = true;
      marquee.hidden = true;
      marqueeStart = null;
      marqueeCurrent = null;
      touchEmptyStart = null;
      cancelLongPress();
    },
  };
}
