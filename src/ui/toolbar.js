import {
  loadState,
  resetState,
  serializeState,
  state,
} from '../state/store.js';

export function createToolbar({ beforeReset, resetSceneState, beforeLoad, afterReset, afterLoad, setStatus }) {
  const newSceneButton = document.getElementById('new-scene');
  const saveJsonButton = document.getElementById('save-json');
  const loadJsonButton = document.getElementById('load-json');
  const loadJsonInput = document.getElementById('load-json-input');

  function saveJson() {
    const blob = new Blob([serializeState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'skate-park.json';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Saved JSON');
  }

  function resetScene() {
    const shouldReset = state.objects.length === 0 || window.confirm('Clear current scene?');

    if (!shouldReset) {
      return;
    }

    beforeReset?.();
    if (resetSceneState) {
      resetSceneState();
    } else {
      resetState();
    }

    afterReset();
    setStatus('Cleared');
  }

  async function loadJsonFile(file) {
    if (!file) {
      return;
    }

    if (file.size > 2_000_000) {
      setStatus('JSON file is too large');
      window.alert('JSON file is too large. Max size is 2 MB.');
      loadJsonInput.value = '';
      return;
    }

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      beforeLoad?.();
      loadState(snapshot);
      afterLoad();
      setStatus(`Loaded ${state.objects.length} objects`);
    } catch (error) {
      console.error(error);
      setStatus('Could not load JSON');
      window.alert('Could not load JSON file.');
    } finally {
      loadJsonInput.value = '';
    }
  }

  newSceneButton.addEventListener('click', resetScene);
  saveJsonButton.addEventListener('click', saveJson);
  loadJsonButton.addEventListener('click', () => loadJsonInput.click());
  loadJsonInput.addEventListener('change', () => loadJsonFile(loadJsonInput.files[0]));
}
