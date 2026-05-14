import * as THREE from 'three';

const AXIS_CONFIG = {
  x: { color: 0xef4444, vector: new THREE.Vector3(1, 0, 0), label: 'X' },
  y: { color: 0x22c55e, vector: new THREE.Vector3(0, 1, 0), label: 'Y' },
  z: { color: 0x3b82f6, vector: new THREE.Vector3(0, 0, 1), label: 'Z' },
};

const PARAM_BY_TYPE = {
  box: { x: 'width', y: 'height', z: 'depth' },
  ledge: { x: 'width', y: 'height', z: 'depth' },
  bank: { x: 'width', y: 'height', z: 'length' },
  quarterPipe: { x: 'width', y: 'height', z: 'radius' },
  halfPipe: { x: 'width', y: 'height', z: 'radius' },
  rail: { y: 'height', z: 'length' },
  stairs: { x: 'width', y: 'height', z: 'treadDepth' },
};

function getPointerNdc(event, element) {
  const rect = element.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  );
}

function snapScale(value) {
  return Math.max(0.1, Math.round(value * 10) / 10);
}

export function createScaleHandles({
  scene,
  camera,
  renderer,
  controls,
  selection,
  objectMeshes,
  getObjectById,
  getSelectedGroupId,
  isObjectLocked,
  onBeforeChange,
  onChange,
  setStatus,
  requestRender,
}) {
  const group = new THREE.Group();
  group.name = 'scale-handles';
  scene.add(group);

  const raycaster = new THREE.Raycaster();
  const handles = new Map();
  let activeDrag = null;
  let enabled = false;

  for (const axis of Object.keys(AXIS_CONFIG)) {
    const config = AXIS_CONFIG[axis];
    const visibleMaterial = new THREE.MeshBasicMaterial({ color: config.color, depthTest: false });
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), visibleMaterial);
    handle.name = `scale-handle-${axis}`;
    handle.renderOrder = 20;
    handle.userData.axis = axis;

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), hitMaterial);
    hit.name = `scale-handle-hit-${axis}`;
    hit.userData.axis = axis;
    hit.userData.isScaleHandle = true;
    hit.renderOrder = 21;
    handle.add(hit);

    group.add(handle);
    handles.set(axis, handle);
  }

  function getSelectedObject() {
    const ids = selection.getSelectedIds();

    if (ids.length !== 1 || getSelectedGroupId()) {
      return null;
    }

    const object = getObjectById(ids[0]);

    if (!object || isObjectLocked(object.id)) {
      return null;
    }

    return object;
  }

  function getParamForAxis(object, axis) {
    return PARAM_BY_TYPE[object.type]?.[axis] ?? null;
  }

  function getHandleHit(event) {
    if (!enabled || !group.visible) {
      return null;
    }

    raycaster.setFromCamera(getPointerNdc(event, renderer.domElement), camera);
    const hitMeshes = [...handles.values()].flatMap((handle) => handle.children);
    const hits = raycaster.intersectObjects(hitMeshes, false);
    return hits[0] ?? null;
  }

  function getDragPoint(event, drag) {
    raycaster.setFromCamera(getPointerNdc(event, renderer.domElement), camera);
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(drag.plane, point) ? point : null;
  }

  function update() {
    if (!enabled) {
      group.visible = false;
      requestRender?.();
      return;
    }

    const object = getSelectedObject();
    const mesh = object ? objectMeshes.get(object.id) : null;

    if (!object || !mesh) {
      group.visible = false;
      requestRender?.();
      return;
    }

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const distance = camera.position.distanceTo(center);
    const handleSize = THREE.MathUtils.clamp(distance * 0.018, 0.18, 0.55);

    group.visible = true;

    for (const [axis, handle] of handles) {
      const param = getParamForAxis(object, axis);
      handle.visible = Boolean(param);

      if (!param) {
        continue;
      }

      const vector = AXIS_CONFIG[axis].vector;
      const offset = new THREE.Vector3(
        axis === 'x' ? size.x / 2 + handleSize * 1.6 : 0,
        axis === 'y' ? size.y / 2 + handleSize * 1.6 : 0,
        axis === 'z' ? size.z / 2 + handleSize * 1.6 : 0
      );

      handle.position.copy(center).add(offset);
      handle.scale.setScalar(handleSize / 0.22);
      handle.quaternion.copy(camera.quaternion);
      handle.userData.param = param;
      handle.userData.axisVector = vector;
    }

    requestRender?.();
  }

  function onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const object = getSelectedObject();

    if (!object) {
      return;
    }

    update();
    const hit = getHandleHit(event);

    if (!hit) {
      return;
    }

    const axis = hit.object.userData.axis;
    const param = getParamForAxis(object, axis);

    if (!param) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const axisVector = AXIS_CONFIG[axis].vector.clone();
    const planeNormal = camera.position.clone().sub(hit.point).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, hit.point);
    const startPoint = getDragPoint(event, { plane }) ?? hit.point.clone();

    activeDrag = {
      pointerId: event.pointerId,
      objectId: object.id,
      axis,
      param,
      axisVector,
      plane,
      startPoint,
      startValue: Number(object.params[param]) || 0.01,
    };

    onBeforeChange?.();
    controls.enabled = false;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    setStatus?.(`Scale ${param}`);
  }

  function onPointerMove(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const object = getObjectById(activeDrag.objectId);
    const point = getDragPoint(event, activeDrag);

    if (!object || !point) {
      return;
    }

    const delta = point.clone().sub(activeDrag.startPoint).dot(activeDrag.axisVector);
    object.params[activeDrag.param] = snapScale(activeDrag.startValue + delta);
    onChange?.(object);
    update();
    setStatus?.(`${activeDrag.param}: ${object.params[activeDrag.param].toFixed(2)}m`);
  }

  function finishDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    controls.enabled = true;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    activeDrag = null;
    update();
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true });
  window.addEventListener('pointerup', finishDrag, { capture: true });
  window.addEventListener('pointercancel', finishDrag, { capture: true });

  return {
    update,
    setEnabled: (nextEnabled) => {
      enabled = Boolean(nextEnabled);
      update();
    },
    hide: () => {
      enabled = false;
      group.visible = false;
      requestRender?.();
    },
    isDragging: () => Boolean(activeDrag),
  };
}
