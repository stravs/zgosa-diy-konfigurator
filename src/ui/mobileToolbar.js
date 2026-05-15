export function createMobileToolbar({
  closeMobileDrawers,
  selectObject,
  measureTool,
  setSelectTool,
  groupSelected,
  undoAction,
  redoAction,
}) {
  document.getElementById('mobile-select').addEventListener('click', () => {
    closeMobileDrawers();
    setSelectTool();
  });

  document.getElementById('mobile-measure').addEventListener('click', () => {
    closeMobileDrawers();
    selectObject(null);
    measureTool.activate();
  });

  document.getElementById('mobile-group').addEventListener('click', groupSelected);
  document.getElementById('mobile-undo').addEventListener('click', undoAction);
  document.getElementById('mobile-redo').addEventListener('click', redoAction);
}
