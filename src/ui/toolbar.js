import {
  loadState,
  resetState,
  serializeState,
  state,
} from '../state/store.js';

export function createToolbar({ afterReset, afterLoad, setStatus }) {
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

    resetState();
    afterReset();
    setStatus('New scene');
  }

  async function loadJsonFile(file) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
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
