export function createMobileToolbar({
  closeMobileDrawers,
  selectObject,
  measureTool,
  undoAction,
  redoAction,
}) {
  setMobileToolLabel('mobile-measure', '📏', 'Measure');
  setMobileToolLabel('mobile-undo', '←', 'Undo');
  setMobileToolLabel('mobile-redo', '→', 'Redo');

  document.getElementById('mobile-measure').addEventListener('click', () => {
    closeMobileDrawers();
    selectObject(null);
    measureTool.activate();
  });

  document.getElementById('mobile-undo').addEventListener('click', undoAction);
  document.getElementById('mobile-redo').addEventListener('click', redoAction);
}

function setMobileToolLabel(id, icon, label) {
  const button = document.getElementById(id);

  if (!button) {
    return;
  }

  const iconSpan = document.createElement('span');
  iconSpan.className = 'tool-icon';
  iconSpan.textContent = icon;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'tool-label';
  labelSpan.textContent = label;

  button.replaceChildren(iconSpan, labelSpan);
}
