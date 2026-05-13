import { catalog } from '../catalog/index.js';
import { state } from '../state/store.js';

export function createLayersPanel({ selectObject }) {
  const layersList = document.getElementById('layers-list');

  function update() {
    layersList.replaceChildren();

    if (state.objects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'layers-empty';
      empty.textContent = 'No objects in scene.';
      layersList.appendChild(empty);
      return;
    }

    for (const object of state.objects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'layer-item';
      button.textContent = `${catalog[object.type]?.label ?? object.type} · ${object.id}`;
      button.addEventListener('click', () => {
        selectObject(object.id);
      });
      layersList.appendChild(button);
    }
  }

  return { update };
}
