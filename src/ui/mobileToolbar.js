export function createMobileToolbar({
  closeMobileDrawers,
  setMoveTool,
  setRotateTool,
  selectObject,
  measureTool,
  setScaleTool,
  groupSelected,
  undoAction,
  redoAction,
  deleteSelected,
}) {
  document.getElementById('mobile-move').addEventListener('click', () => {
    closeMobileDrawers();
    setMoveTool();
  });

  document.getElementById('mobile-rotate').addEventListener('click', () => {
    closeMobileDrawers();
    setRotateTool();
  });

  document.getElementById('mobile-scale').addEventListener('click', () => {
    closeMobileDrawers();
    setScaleTool();
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
