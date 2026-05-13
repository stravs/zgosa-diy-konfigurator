import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { getObjectById, state } from '../state/store.js';

function simplifyTransformGizmo(transformControls) {
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

function getSelectionCenter(ids, objectMeshes) {
  const center = new THREE.Vector3();
  let count = 0;

  for (const id of ids) {
    const mesh = objectMeshes.get(id);

    if (!mesh) {
      continue;
    }

    center.add(mesh.position);
    count += 1;
  }

  return count === 0 ? center : center.divideScalar(count);
}

export function createSelection({ scene, camera, renderer, controls, objectMeshes, onChange, setStatus }) {
  const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xf97316);
  selectionHelper.visible = false;
  scene.add(selectionHelper);

  const multiSelectionHelper = new THREE.Box3Helper(new THREE.Box3(), 0xf97316);
  multiSelectionHelper.visible = false;
  scene.add(multiSelectionHelper);

  const transformGroup = new THREE.Group();
  transformGroup.name = 'selection-transform-group';
  scene.add(transformGroup);

  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode('translate');
  transformControls.setTranslationSnap(state.scene.gridSize);
  transformControls.setRotationSnap(THREE.MathUtils.degToRad(1));
  scene.add(transformControls.getHelper());
  simplifyTransformGizmo(transformControls);

  let selectedObjectIds = [];
  let selectedMesh = null;
  let transformSnapshot = null;

  function getSelectedObjects() {
    return selectedObjectIds
      .map((id) => getObjectById(id))
      .filter(Boolean);
  }

  function updateMultiBounds() {
    const box = new THREE.Box3();
    let hasBox = false;

    for (const id of selectedObjectIds) {
      const mesh = objectMeshes.get(id);

      if (!mesh) {
        continue;
      }

      const meshBox = new THREE.Box3().setFromObject(mesh);
      box.union(meshBox);
      hasBox = true;
    }

    if (!hasBox) {
      multiSelectionHelper.visible = false;
      return;
    }

    multiSelectionHelper.box.copy(box);
    multiSelectionHelper.visible = true;
  }

  function updateHelper() {
    selectedObjectIds = selectedObjectIds.filter((id) => objectMeshes.has(id));
    selectedMesh = selectedObjectIds.length === 1 ? objectMeshes.get(selectedObjectIds[0]) ?? null : null;

    if (selectedObjectIds.length === 0) {
      selectionHelper.visible = false;
      multiSelectionHelper.visible = false;
      transformControls.detach();
      return;
    }

    if (selectedObjectIds.length === 1 && selectedMesh) {
      multiSelectionHelper.visible = false;
      selectionHelper.visible = true;
      selectionHelper.setFromObject(selectedMesh);
      transformControls.attach(selectedMesh);
      return;
    }

    const center = getSelectionCenter(selectedObjectIds, objectMeshes);
    transformGroup.position.copy(center);
    transformGroup.rotation.set(0, 0, 0);
    selectionHelper.visible = false;
    transformControls.attach(transformGroup);
    updateMultiBounds();
  }

  function select(objectId) {
    selectedObjectIds = objectId ? [objectId] : [];
    updateHelper();
  }

  function selectMany(objectIds) {
    selectedObjectIds = [...new Set(objectIds)].filter(Boolean);
    updateHelper();
  }

  function toggle(objectId) {
    if (!objectId) {
      return;
    }

    selectedObjectIds = selectedObjectIds.includes(objectId)
      ? selectedObjectIds.filter((id) => id !== objectId)
      : [...selectedObjectIds, objectId];
    updateHelper();
  }

  function syncSelectedObjectFromMesh() {
    const object = selectedObjectIds.length === 1 ? getObjectById(selectedObjectIds[0]) : null;

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
    onChange?.(object);
  }

  function beginGroupTransform() {
    if (selectedObjectIds.length < 2) {
      return;
    }

    transformSnapshot = {
      pivot: transformGroup.position.clone(),
      groupPosition: transformGroup.position.clone(),
      groupQuaternion: transformGroup.quaternion.clone(),
      objects: getSelectedObjects().map((object) => ({
        id: object.id,
        position: new THREE.Vector3(object.position.x, object.position.y, object.position.z),
        quaternion: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(object.rotation.x, object.rotation.y, object.rotation.z)
        ),
      })),
    };
  }

  function syncGroupTransform() {
    if (!transformSnapshot) {
      return;
    }

    const deltaPosition = transformGroup.position.clone().sub(transformSnapshot.groupPosition);
    const inverseStartQuaternion = transformSnapshot.groupQuaternion.clone().invert();
    const deltaQuaternion = transformGroup.quaternion.clone().multiply(inverseStartQuaternion);

    for (const item of transformSnapshot.objects) {
      const object = getObjectById(item.id);
      const mesh = objectMeshes.get(item.id);

      if (!object || !mesh) {
        continue;
      }

      const offset = item.position.clone().sub(transformSnapshot.pivot);
      offset.applyQuaternion(deltaQuaternion);
      const nextPosition = transformSnapshot.pivot.clone().add(offset).add(deltaPosition);

      object.position.x = nextPosition.x;
      object.position.y = nextPosition.y;
      object.position.z = nextPosition.z;
      const nextQuaternion = deltaQuaternion.clone().multiply(item.quaternion);
      const nextRotation = new THREE.Euler().setFromQuaternion(nextQuaternion);

      object.rotation.x = nextRotation.x;
      object.rotation.y = nextRotation.y;
      object.rotation.z = nextRotation.z;

      mesh.position.copy(nextPosition);
      mesh.quaternion.copy(nextQuaternion);
    }

    updateMultiBounds();
    onChange?.(null);
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

    simplifyTransformGizmo(transformControls);
    setStatus?.(`${mode === 'rotate' ? 'Rotate' : 'Move'} tool active`);
  }

  transformControls.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;

    if (event.value) {
      beginGroupTransform();
    } else if (transformSnapshot) {
      syncGroupTransform();
      transformSnapshot = null;
      updateHelper();
    }
  });

  transformControls.addEventListener('objectChange', () => {
    if (selectedObjectIds.length > 1) {
      syncGroupTransform();
      return;
    }

    syncSelectedObjectFromMesh();
  });

  return {
    select,
    selectMany,
    toggle,
    updateHelper,
    setTransformMode,
    isUsingTransformControls: () => Boolean(selectedObjectIds.length > 0 && transformControls.axis),
    getSelectedId: () => selectedObjectIds[0] ?? null,
    getSelectedIds: () => [...selectedObjectIds],
    getSelectedMesh: () => selectedMesh,
    updateSelectedMeshBounds: () => {
      if (selectedMesh) {
        selectionHelper.setFromObject(selectedMesh);
      } else if (selectedObjectIds.length > 1) {
        updateMultiBounds();
      }
    },
  };
}
