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

export function createSelection({ scene, camera, renderer, controls, objectMeshes, onChange, setStatus }) {
  const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xf97316);
  selectionHelper.visible = false;
  scene.add(selectionHelper);

  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode('translate');
  transformControls.setTranslationSnap(state.scene.gridSize);
  transformControls.setRotationSnap(Math.PI / 2);
  scene.add(transformControls.getHelper());
  simplifyTransformGizmo(transformControls);

  let selectedObjectId = null;
  let selectedMesh = null;

  function updateHelper() {
    selectedMesh = selectedObjectId ? objectMeshes.get(selectedObjectId) ?? null : null;
    selectionHelper.visible = Boolean(selectedMesh);

    if (selectedMesh) {
      selectionHelper.setFromObject(selectedMesh);
      transformControls.attach(selectedMesh);
    } else {
      transformControls.detach();
    }
  }

  function select(objectId) {
    selectedObjectId = objectId;
    updateHelper();
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
    onChange?.(object);
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
  });

  transformControls.addEventListener('objectChange', () => {
    syncSelectedObjectFromMesh();
  });

  return {
    select,
    updateHelper,
    setTransformMode,
    isUsingTransformControls: () => Boolean(selectedObjectId && transformControls.axis),
    getSelectedId: () => selectedObjectId,
    getSelectedMesh: () => selectedMesh,
    updateSelectedMeshBounds: () => {
      if (selectedMesh) {
        selectionHelper.setFromObject(selectedMesh);
      }
    },
  };
}
