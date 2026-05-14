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

  function getObjectHit(event, options = {}) {
    update(event);
    const excludeIds = new Set(options.excludeIds ?? []);
    const hits = raycaster.intersectObjects(objectLayer.children, true);
    return hits.find((hit) => {
      const objectId = hit.object.userData.objectId;
      return objectId && !excludeIds.has(objectId);
    }) ?? null;
  }

  function getPlacementHit(event, options = {}) {
    const objectHit = getObjectHit(event, options);

    if (objectHit) {
      return objectHit;
    }

    return getGroundHit(event);
  }

  return {
    getGroundHit,
    getObjectHit,
    getPlacementHit,
  };
}
