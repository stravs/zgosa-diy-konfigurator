export function preventBrowserZoom() {
  let lastTouchEnd = 0;

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    const isZoomKey = ['+', '=', '-', '_', '0'].includes(event.key);

    if ((event.ctrlKey || event.metaKey) && isZoomKey) {
      event.preventDefault();
    }
  });

  window.addEventListener('gesturestart', (event) => {
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('gesturechange', (event) => {
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('gestureend', (event) => {
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchend', (event) => {
    const now = Date.now();

    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }

    lastTouchEnd = now;
  }, { passive: false });
}
