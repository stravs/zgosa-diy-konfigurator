import { catalog } from '../catalog/index.js';
import { state } from '../state/store.js';

export function createLayersPanel({ selectObject, selectGroup, renameGroup, shouldShowObject = () => true, shouldShowGroup = () => true }) {
  const layersList = document.getElementById('layers-list');
  const expandedGroupIds = new Set();

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

    summary.append(name);

    let renameTimer = null;
    let clickTimer = null;
    let startPoint = null;

    function promptRename() {
      const nextName = window.prompt('Group name', group.name);

      if (nextName !== null) {
        renameGroup(group.id, nextName);
      }
    }

    function cancelRenameTimer() {
      if (renameTimer) {
        window.clearTimeout(renameTimer);
        renameTimer = null;
      }

      startPoint = null;
    }

    summary.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (clickTimer) {
        window.clearTimeout(clickTimer);
        clickTimer = null;
      }

      promptRename();
    });

    summary.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') {
        return;
      }

      startPoint = { x: event.clientX, y: event.clientY };
      renameTimer = window.setTimeout(() => {
        renameTimer = null;
        startPoint = null;
        promptRename();
      }, 550);
    });

    summary.addEventListener('pointermove', (event) => {
      if (!startPoint) {
        return;
      }

      const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y);

      if (distance > 10) {
        cancelRenameTimer();
      }
    });

    summary.addEventListener('pointerup', cancelRenameTimer);
    summary.addEventListener('pointercancel', cancelRenameTimer);
    summary.addEventListener('click', (event) => {
      event.preventDefault();

      if (event.detail > 1) {
        return;
      }

      if (clickTimer) {
        window.clearTimeout(clickTimer);
      }

      clickTimer = window.setTimeout(() => {
        clickTimer = null;

        if (details.open) {
          expandedGroupIds.delete(group.id);
        } else {
          expandedGroupIds.add(group.id);
        }

        selectGroup(group.id);
      }, 220);
    });

    return summary;
  }

  function update() {
    layersList.replaceChildren();

    const visibleObjects = state.objects.filter(shouldShowObject);
    const visibleGroups = state.groups.filter(shouldShowGroup);

    if (visibleObjects.length === 0 && visibleGroups.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'layers-empty';
      empty.textContent = 'No objects in scene.';
      layersList.appendChild(empty);
      return;
    }

    for (const group of visibleGroups) {
      const details = document.createElement('details');
      details.className = 'layer-group';
      details.open = expandedGroupIds.has(group.id);
      details.appendChild(createGroupSummary(group, details));

      for (const objectId of group.objectIds) {
        const object = state.objects.find((item) => item.id === objectId);

        if (object && shouldShowObject(object)) {
          details.appendChild(createObjectButton(object));
        }
      }

      layersList.appendChild(details);
    }

    const existingGroupIds = new Set(visibleGroups.map((group) => group.id));

    for (const groupId of expandedGroupIds) {
      if (!existingGroupIds.has(groupId)) {
        expandedGroupIds.delete(groupId);
      }
    }

    const groupedObjectIds = new Set(visibleGroups.flatMap((group) => group.objectIds));
    const ungroupedObjects = visibleObjects.filter((object) => !groupedObjectIds.has(object.id));

    for (const object of ungroupedObjects) {
      layersList.appendChild(createObjectButton(object));
    }
  }

  return { update };
}
