export function createMobileToolbar({
  closeMobileDrawers,
  selection,
  selectObject,
  measureTool,
  groupSelected,
  undoAction,
  redoAction,
  deleteSelected,
}) {
  document.getElementById('mobile-move').addEventListener('click', () => {
    closeMobileDrawers();
    selection.setTransformMode('translate');
  });

  document.getElementById('mobile-rotate').addEventListener('click', () => {
    closeMobileDrawers();
    selection.setTransformMode('rotate');
  });

  document.getElementById('mobile-measure').addEventListener('click', () => {
    closeMobileDrawers();
    selectObject(null);
    measureTool.activate();
  });

  document.getElementById('mobile-group').addEventListener('click', groupSelected);
  document.getElementById('mobile-undo').addEventListener('click', undoAction);
  document.getElementById('mobile-redo').addEventListener('click', redoAction);
  document.getElementById('mobile-delete').addEventListener('click', deleteSelected);
}
