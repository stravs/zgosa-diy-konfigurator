export function createShortcuts({
  unselect,
  setMoveTool,
  setRotateTool,
  deleteSelected,
  duplicateSelected,
}) {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const isFormControl = target instanceof HTMLElement
      && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);

    if (isFormControl) {
      return;
    }

    if (event.key === 'Escape') {
      unselect();
    } else if (event.key === 'm' || event.key === 'M') {
      setMoveTool();
    } else if (event.key === 'r' || event.key === 'R') {
      setRotateTool();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      deleteSelected();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelected();
    }
  });
}
