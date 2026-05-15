import { catalog } from '../catalog/index.js';
import { state } from '../state/store.js';

export function createSceneObjectsPanel({
  selectObject,
  selectGroup,
  renameGroup,
  toggleObjectLocked,
  toggleGroupLocked,
  isObjectLocked = () => false,
  isGroupLocked = () => false,
  shouldShowObject = () => true,
  shouldShowGroup = () => true,
}) {
  const sceneObjectsList = document.getElementById('scene-objects-list');
  const expandedGroupIds = new Set();

  function createLockButton({ locked, label, onToggle }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-lock-button';
    button.textContent = locked ? '🔒' : '🔓';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    });
    return button;
  }

  function createObjectButton(object) {
    const row = document.createElement('div');
    row.className = `scene-object-row${isObjectLocked(object.id) ? ' locked' : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-object-item';
    button.textContent = `${catalog[object.type]?.label ?? object.type} · ${object.id}`;
    button.addEventListener('click', () => {
      if (isObjectLocked(object.id)) {
        return;
      }

      selectObject(object.id, { skipGroupSelect: true });
    });

    row.append(
      button,
      createLockButton({
        locked: isObjectLocked(object.id),
        label: isObjectLocked(object.id) ? 'Unlock object' : 'Lock object',
        onToggle: () => toggleObjectLocked?.(object.id),
      })
    );
    return row;
  }

  function createGroupSummary(group, details) {
    const summary = document.createElement('summary');
    summary.className = `scene-group-summary${isGroupLocked(group.id) ? ' locked' : ''}`;

    const name = document.createElement('span');
    name.textContent = `${group.name} · ${group.objectIds.length} objects`;

    summary.append(
      name,
      createLockButton({
        locked: isGroupLocked(group.id),
        label: isGroupLocked(group.id) ? 'Unlock group' : 'Lock group',
        onToggle: () => toggleGroupLocked?.(group.id),
      })
    );

    let renameTimer = null;
    let clickTimer = null;
    let startPoint = null;

    function promptRename() {
      if (isGroupLocked(group.id)) {
        return;
      }

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

        if (!isGroupLocked(group.id)) {
          selectGroup(group.id);
        }
      }, 220);
    });

    return summary;
  }

  function update() {
    sceneObjectsList.replaceChildren();

    const visibleObjects = state.objects.filter(shouldShowObject);
    const visibleGroups = state.groups.filter(shouldShowGroup);

    if (visibleObjects.length === 0 && visibleGroups.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'scene-objects-empty';
      empty.textContent = 'No objects in scene.';
      sceneObjectsList.appendChild(empty);
      return;
    }

    for (const group of visibleGroups) {
      const details = document.createElement('details');
      details.className = `scene-group${isGroupLocked(group.id) ? ' locked' : ''}`;
      details.open = expandedGroupIds.has(group.id);
      details.appendChild(createGroupSummary(group, details));

      for (const objectId of group.objectIds) {
        const object = state.objects.find((item) => item.id === objectId);

        if (object && shouldShowObject(object)) {
          details.appendChild(createObjectButton(object));
        }
      }

      sceneObjectsList.appendChild(details);
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
      sceneObjectsList.appendChild(createObjectButton(object));
    }
  }

  return { update };
}
