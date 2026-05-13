import * as THREE from 'three';

export function createRaycaster({ renderer, camera, ground, objectLayer }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function update(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function getGroundHit(event) {
    update(event);
    const [hit] = raycaster.intersectObject(ground);
    return hit ?? null;
  }

  function getObjectHit(event) {
    update(event);
    const hits = raycaster.intersectObjects(objectLayer.children, true);
    return hits.find((hit) => hit.object.userData.objectId) ?? null;
  }

  return {
    getGroundHit,
    getObjectHit,
  };
}
