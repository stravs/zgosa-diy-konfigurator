import * as THREE from 'three';
import { isMobileQuality } from '../core/performance.js';

export function createDrawers({ leftPanel, rightPanel, objectsHandleButton, sceneHandleButton }) {
  function closeObjectsDrawer() {
    document.body.classList.remove('show-objects-panel');
    leftPanel.classList.remove('drawer-open');
    leftPanel.style.transform = '';
    objectsHandleButton.style.transform = '';
  }

  function closeSceneDrawer() {
    document.body.classList.remove('show-right-panel');
    rightPanel.classList.remove('drawer-open');
    rightPanel.style.transform = '';
    sceneHandleButton.style.transform = '';
  }

  function closeMobileDrawers() {
    closeObjectsDrawer();
    closeSceneDrawer();
  }

  function openObjectsDrawer() {
    document.body.classList.add('show-objects-panel');
    leftPanel.classList.add('drawer-open');
    leftPanel.style.transform = '';
    objectsHandleButton.style.transform = `translateY(-50%) translateX(${leftPanel.getBoundingClientRect().width}px)`;
  }

  function openSceneDrawer() {
    document.body.classList.add('show-right-panel');
    rightPanel.classList.add('drawer-open');
    rightPanel.style.transform = '';
    sceneHandleButton.style.transform = `translateY(-50%) translateX(${-rightPanel.getBoundingClientRect().width}px)`;
  }

  function toggleObjectsDrawer() {
    if (leftPanel.classList.contains('drawer-open')) {
      closeObjectsDrawer();
    } else {
      openObjectsDrawer();
    }
  }

  function toggleSceneDrawer() {
    if (rightPanel.classList.contains('drawer-open')) {
      closeSceneDrawer();
    } else {
      openSceneDrawer();
    }
  }

  function setDrawerProgress(panel, handle, side, progress) {
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const width = panel.getBoundingClientRect().width;

    if (side === 'left') {
      panel.style.transform = `translateX(${(clampedProgress - 1) * 100}%)`;
      handle.style.transform = `translateY(-50%) translateX(${clampedProgress * width}px)`;
    } else {
      panel.style.transform = `translateX(${(1 - clampedProgress) * 100}%)`;
      handle.style.transform = `translateY(-50%) translateX(${-clampedProgress * width}px)`;
    }
  }

  function createDrawerHandleDrag({ handle, panel, side, open }) {
    let startX = 0;
    let startProgress = 0;
    let latestProgress = 0;
    let didDrag = false;

    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      startX = event.clientX;
      startProgress = panel.classList.contains('drawer-open') ? 1 : 0;
      latestProgress = startProgress;
      didDrag = false;
      panel.style.transition = 'none';
      handle.style.transition = 'none';
    });

    handle.addEventListener('pointermove', (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) {
        return;
      }

      const width = panel.getBoundingClientRect().width;
      const delta = side === 'left' ? event.clientX - startX : startX - event.clientX;
      latestProgress = THREE.MathUtils.clamp(startProgress + (delta / width), 0, 1);
      didDrag = didDrag || Math.abs(delta) > 4;
      setDrawerProgress(panel, handle, side, latestProgress);
    });

    handle.addEventListener('pointerup', (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) {
        return;
      }

      handle.releasePointerCapture(event.pointerId);
      panel.style.transition = '';
      handle.style.transition = '';

      if (!didDrag) {
        open();
        return;
      }

      if (latestProgress > 0.45) {
        open();
      } else if (side === 'left') {
        closeObjectsDrawer();
      } else {
        closeSceneDrawer();
      }
    });
  }

  createDrawerHandleDrag({
    handle: objectsHandleButton,
    panel: leftPanel,
    side: 'left',
    open: toggleObjectsDrawer,
  });

  createDrawerHandleDrag({
    handle: sceneHandleButton,
    panel: rightPanel,
    side: 'right',
    open: toggleSceneDrawer,
  });

  if (isMobileQuality()) {
    const folders = [...leftPanel.querySelectorAll('.object-folder')];
    folders.forEach((folder, index) => {
      folder.open = index === 0;
    });
  } else {
    openObjectsDrawer();
    openSceneDrawer();
  }

  return {
    closeSceneDrawer,
    closeMobileDrawers,
    openObjectsDrawer,
  };
}
