import {
  COARSE_POINTER_QUERY,
  COMPACT_LAYOUT_QUERY,
} from '../core/performance.js';

export function createResponsiveController({
  app,
  camera,
  renderer,
  controls,
  drawers,
  getDevicePixelRatioCap,
  hasCoarsePointer,
  isCompactLayout,
  onToolModeChange,
  onDesktopLayout,
  requestRender,
}) {
  function updateControlProfile() {
    const useTouchProfile = hasCoarsePointer();
    controls.minDistance = useTouchProfile ? 1.2 : 4;
    controls.panSpeed = useTouchProfile ? 0.8 : 1;
    controls.zoomSpeed = useTouchProfile ? 0.7 : 1;
    controls.rotateSpeed = useTouchProfile ? 0.75 : 1;
  }

  function resize() {
    camera.aspect = app.clientWidth / app.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, getDevicePixelRatioCap()));
    renderer.setSize(app.clientWidth, app.clientHeight);
    requestRender();
  }

  function update() {
    updateControlProfile();
    onToolModeChange?.();
    drawers?.syncLayoutMode();

    if (!isCompactLayout()) {
      onDesktopLayout?.();
    }

    resize();
  }

  function addMediaChangeListener(query, handler) {
    const mediaQueryList = window.matchMedia(query);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handler);
      return () => mediaQueryList.removeEventListener('change', handler);
    }

    mediaQueryList.addListener(handler);
    return () => mediaQueryList.removeListener(handler);
  }

  const removeCompactListener = addMediaChangeListener(COMPACT_LAYOUT_QUERY, update);
  const removePointerListener = addMediaChangeListener(COARSE_POINTER_QUERY, update);
  window.addEventListener('resize', resize);
  update();

  return {
    resize,
    update,
    destroy: () => {
      window.removeEventListener('resize', resize);
      removeCompactListener();
      removePointerListener();
    },
  };
}
