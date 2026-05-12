export function createContextMenu({ renderer, getGroundHit, spawnObject, getLastGroundHit }) {
  const contextMenu = document.getElementById('context-menu');
  let contextSpawnPosition = null;

  function show(event, position) {
    contextSpawnPosition = position;
    contextMenu.hidden = false;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
  }

  function hide() {
    contextMenu.hidden = true;
    contextSpawnPosition = null;
  }

  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const hit = getGroundHit(event);

    if (!hit) {
      hide();
      return;
    }

    show(event, {
      x: hit.point.x,
      y: 0,
      z: hit.point.z,
    });
  });

  window.addEventListener('click', (event) => {
    if (!contextMenu.contains(event.target)) {
      hide();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide();
    }
  });

  document.querySelectorAll('[data-context-add]').forEach((button) => {
    button.addEventListener('click', () => {
      spawnObject(button.dataset.contextAdd, contextSpawnPosition ?? getLastGroundHit());
      hide();
    });
  });

  return { hide };
}
