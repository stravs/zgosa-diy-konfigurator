import * as THREE from 'three';

function getScreenPoint({ camera, renderer, objectMeshes, selectedIds }) {
  if (selectedIds.length === 0) {
    return null;
  }

  const box = new THREE.Box3();
  let hasBox = false;

  for (const id of selectedIds) {
    const mesh = objectMeshes.get(id);

    if (!mesh) {
      continue;
    }

    box.union(new THREE.Box3().setFromObject(mesh));
    hasBox = true;
  }

  if (!hasBox) {
    return null;
  }

  const center = box.getCenter(new THREE.Vector3());
  center.y = box.max.y;
  const projected = center.project(camera);

  if (projected.z < -1 || projected.z > 1) {
    return null;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((-projected.y + 1) / 2) * rect.height,
  };
}

function setButtonContent(button, icon, label) {
  const iconSpan = document.createElement('span');
  iconSpan.className = 'tool-icon';
  iconSpan.textContent = icon;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'tool-label';
  labelSpan.textContent = label;

  button.replaceChildren(iconSpan, labelSpan);
}

export function createObjectActions({
  camera,
  renderer,
  objectMeshes,
  selection,
  getSelectedGroupId,
  getObjectById,
  setMoveTool,
  setRotateTool,
  setScaleTool,
  groupSelected,
  ungroupSelected,
  deleteSelected,
  openProperties,
  shouldHide = () => false,
}) {
  const panel = document.createElement('div');
  panel.className = 'object-actions expanded';
  panel.hidden = true;

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'object-actions-toggle';
  setButtonContent(toggleButton, '↔', 'Tools');
  toggleButton.title = 'Object tools';
  toggleButton.setAttribute('aria-label', 'Object tools');

  const buttons = document.createElement('div');
  buttons.className = 'object-actions-buttons';

  let expanded = true;
  let activeIcon = '↔';
  let lastSelectionKey = '';

  const moveButton = createButton('↔', 'Move', () => setMoveTool());
  const rotateButton = createButton('⟳', 'Rotate', () => setRotateTool());
  const scaleButton = createButton('⬚', 'Extend', () => setScaleTool());
  const propertiesButton = createButton('⚙', 'Props', () => {
    const id = selection.getSelectedIds()[0];
    if (id) openProperties(id);
  });
  const groupButton = createButton('⧉', 'Group', () => {
    if (getSelectedGroupId()) {
      ungroupSelected?.();
    } else {
      groupSelected();
    }
  });
  const deleteButton = createButton('🗑', 'Delete', () => deleteSelected());
  deleteButton.classList.add('danger');

  buttons.append(moveButton, rotateButton, scaleButton, propertiesButton, groupButton, deleteButton);
  panel.append(toggleButton, buttons);
  document.body.appendChild(panel);

  function setExpanded(nextExpanded) {
    expanded = nextExpanded;
    panel.classList.toggle('expanded', expanded);
    panel.classList.toggle('collapsed', !expanded);
    setButtonContent(toggleButton, activeIcon, 'Tools');

    if (expanded && panel.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  function createButton(icon, label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    setButtonContent(button, icon, label);
    button.title = label;
    button.setAttribute('aria-label', label);
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeIcon = icon;
      button.blur();
      onClick();
      setExpanded(false);
      update();
    });
    return button;
  }

  toggleButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  toggleButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleButton.blur();
    setExpanded(true);
  });

  function update() {
    if (shouldHide()) {
      panel.hidden = true;
      return;
    }

    const selectedIds = selection.getSelectedIds();
    const selectedGroupId = getSelectedGroupId();
    const selectionKey = `${selectedGroupId || ''}:${selectedIds.join(',')}`;

    if (selectedIds.length === 0) {
      panel.hidden = true;
      lastSelectionKey = '';
      return;
    }

    if (selectionKey !== lastSelectionKey) {
      lastSelectionKey = selectionKey;
      setExpanded(selectedIds.length > 1);
    }

    const point = getScreenPoint({ camera, renderer, objectMeshes, selectedIds });

    if (!point) {
      panel.hidden = true;
      return;
    }

    const object = selectedIds.length === 1 && !selectedGroupId
      ? getObjectById(selectedIds[0])
      : null;
    const isMulti = selectedIds.length > 1;

    moveButton.hidden = false;
    rotateButton.hidden = false;
    scaleButton.hidden = isMulti || !object || object.type !== 'box';
    propertiesButton.hidden = isMulti || !object;
    deleteButton.hidden = false;
    groupButton.hidden = !isMulti;
    const groupLabel = selectedGroupId ? 'Ungroup' : 'Group';
    setButtonContent(groupButton, '⧉', groupLabel);
    groupButton.title = groupLabel;
    groupButton.setAttribute('aria-label', groupLabel);
    scaleButton.disabled = false;
    scaleButton.title = 'Extend face';

    panel.hidden = false;
    panel.style.transform = `translate(${Math.round(point.x + 40)}px, ${Math.round(point.y - 48)}px) translate(-50%, -100%)`;
  }

  return {
    update,
    expand: () => {
      setExpanded(true);
      update();
    },
    setActiveIcon: (icon) => {
      activeIcon = icon;
      setButtonContent(toggleButton, activeIcon, 'Tools');
    },
    hide: () => {
      panel.hidden = true;
    },
  };
}
