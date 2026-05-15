export const COMPACT_LAYOUT_QUERY = '(max-width: 1100px)';
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function isCompactLayout() {
  return window.matchMedia(COMPACT_LAYOUT_QUERY).matches;
}

export function hasCoarsePointer() {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

export function isLowQuality() {
  return isCompactLayout() || hasCoarsePointer();
}

export function getDevicePixelRatioCap() {
  return isLowQuality() ? 1.25 : 2;
}

export function getCurveSegments(desktopSegments, lowQualitySegments) {
  return isLowQuality() ? lowQualitySegments : desktopSegments;
}
