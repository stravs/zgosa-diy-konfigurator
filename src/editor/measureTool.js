import * as THREE from 'three';

export function createMeasureTool({ scene, renderer, raycast, setStatus, requestRender }) {
  const points = [];
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({ color: 0x00ff66 });
  const line = new THREE.Line(geometry, material);
  line.visible = false;
  scene.add(line);

  const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
  const startMarker = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), pointMaterial);
  const endMarker = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), pointMaterial);
  startMarker.visible = false;
  endMarker.visible = false;
  scene.add(startMarker);
  scene.add(endMarker);

  const tooltip = document.createElement('div');
  tooltip.className = 'measure-tooltip';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  let isActive = false;
  let previewPoint = null;

  function positionTooltip(event) {
    tooltip.style.left = `${event.clientX + 14}px`;
    tooltip.style.top = `${event.clientY + 14}px`;
  }

  function setTooltip(event, text) {
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(event);
  }

  function setLine(start, end) {
    geometry.setFromPoints([
      new THREE.Vector3(start.x, start.y + 0.05, start.z),
      new THREE.Vector3(end.x, end.y + 0.05, end.z),
    ]);
    line.visible = true;
    requestRender?.();
    startMarker.visible = true;
    endMarker.visible = true;
    startMarker.position.set(start.x, start.y + 0.08, start.z);
    endMarker.position.set(end.x, end.y + 0.08, end.z);
  }

  function getDistance(start, end) {
    return start.distanceTo(end);
  }

  function activate() {
    isActive = true;
    points.length = 0;
    previewPoint = null;
    line.visible = false;
    startMarker.visible = false;
    endMarker.visible = false;
    tooltip.hidden = false;
    tooltip.textContent = 'Click first point';
    setStatus('Measure: click first point');
    requestRender?.();
  }

  function clear() {
    isActive = false;
    points.length = 0;
    previewPoint = null;
    line.visible = false;
    startMarker.visible = false;
    endMarker.visible = false;
    tooltip.hidden = true;
    requestRender?.();
  }

  function onPointerMove(event) {
    if (!isActive) {
      return;
    }

    positionTooltip(event);

    if (points.length === 0) {
      tooltip.textContent = 'Click first point';
      return;
    }

    if (points.length >= 2) {
      tooltip.textContent = `${getDistance(points[0], points[1]).toFixed(2)}m · click to quit`;
      return;
    }

    const hit = raycast.getGroundHit(event);

    if (!hit) {
      return;
    }

    previewPoint = hit.point.clone();
    const distance = getDistance(points[0], previewPoint).toFixed(2);
    setLine(points[0], previewPoint);
    setTooltip(event, `${distance}m`);
    setStatus(`Measure: ${distance}m`);
  }

  function onPointerDown(event) {
    if (!isActive || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (points.length >= 2) {
      clear();
      setStatus('Measure closed');
      return;
    }

    const hit = raycast.getGroundHit(event);

    if (!hit) {
      return;
    }

    if (points.length === 0) {
      points.push(hit.point.clone());
      startMarker.visible = true;
      startMarker.position.set(hit.point.x, hit.point.y + 0.08, hit.point.z);
      setTooltip(event, 'Click second point');
      setStatus('Measure: click second point');
      requestRender?.();
      return;
    }

    if (points.length === 1) {
      points.push(hit.point.clone());
      setLine(points[0], points[1]);
      const distance = getDistance(points[0], points[1]).toFixed(2);
      setTooltip(event, `${distance}m · click to quit`);
      setStatus(`Distance: ${distance}m. Click to quit measure.`);
    }
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });

  return {
    activate,
    clear,
    isActive: () => isActive,
  };
}
