import { catalog } from '../catalog/index.js';
import { state } from '../state/store.js';

export function createLayersPanel({ selectObject, selectGroup, renameGroup }) {
  const layersList = document.getElementById('layers-list');
  const collapsedGroupIds = new Set();

  function createObjectButton(object) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layer-item';
    button.textContent = `${catalog[object.type]?.label ?? object.type} · ${object.id}`;
    button.addEventListener('click', () => {
      selectObject(object.id, { skipGroupSelect: true });
    });
    return button;
  }

  function createGroupSummary(group, details) {
    const summary = document.createElement('summary');
    summary.className = 'layer-group-summary';

    const name = document.createElement('span');
    name.textContent = `${group.name} · ${group.objectIds.length} objects`;

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'layer-rename-button';
    renameButton.textContent = 'Rename';
    renameButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const nextName = window.prompt('Group name', group.name);

      if (nextName !== null) {
        renameGroup(group.id, nextName);
      }
    });

    summary.append(name, renameButton);
    summary.addEventListener('click', (event) => {
      event.preventDefault();

      if (details.open) {
        collapsedGroupIds.add(group.id);
      } else {
        collapsedGroupIds.delete(group.id);
      }

      selectGroup(group.id);
    });

    return summary;
  }

  function update() {
    layersList.replaceChildren();

    if (state.objects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'layers-empty';
      empty.textContent = 'No objects in scene.';
      layersList.appendChild(empty);
      return;
    }

    for (const group of state.groups) {
      const details = document.createElement('details');
      details.className = 'layer-group';
      details.open = !collapsedGroupIds.has(group.id);
      details.appendChild(createGroupSummary(group, details));

      for (const objectId of group.objectIds) {
        const object = state.objects.find((item) => item.id === objectId);

        if (object) {
          details.appendChild(createObjectButton(object));
        }
      }

      layersList.appendChild(details);
    }

    const existingGroupIds = new Set(state.groups.map((group) => group.id));

    for (const groupId of collapsedGroupIds) {
      if (!existingGroupIds.has(groupId)) {
        collapsedGroupIds.delete(groupId);
      }
    }

    const groupedObjectIds = new Set(state.groups.flatMap((group) => group.objectIds));
    const ungroupedObjects = state.objects.filter((object) => !groupedObjectIds.has(object.id));

    for (const object of ungroupedObjects) {
      layersList.appendChild(createObjectButton(object));
    }
  }

  return { update };
}
