export function createShortcuts({
  unselect,
  setMoveTool,
  setRotateTool,
  setScaleTool,
  activateMeasureTool,
  deleteSelected,
  duplicateSelected,
  groupSelected,
  ungroupSelected,
  undo,
  redo,
}) {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const isFormControl = target instanceof HTMLElement
      && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);

    if (isFormControl) {
      return;
    }

    const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();

      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
    } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      ungroupSelected();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      groupSelected();
    } else if (event.key === 'Escape') {
      unselect();
    } else if (event.code === 'Space') {
      event.preventDefault();
      setMoveTool();
    } else if (!hasModifier && (event.key === 'r' || event.key === 'R')) {
      setRotateTool();
    } else if (!hasModifier && (event.key === 's' || event.key === 'S')) {
      setScaleTool();
    } else if (!hasModifier && (event.key === 'm' || event.key === 'M')) {
      activateMeasureTool();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      deleteSelected();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelected();
    }
  });
}
