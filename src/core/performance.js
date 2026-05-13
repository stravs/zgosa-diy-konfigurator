export function isMobileQuality() {
  return window.matchMedia('(max-width: 1100px), (pointer: coarse)').matches;
}

export function getDevicePixelRatioCap() {
  return isMobileQuality() ? 1.25 : 2;
}

export function getCurveSegments(desktopSegments, mobileSegments) {
  return isMobileQuality() ? mobileSegments : desktopSegments;
}
