export function createTopMenu({ setGridVisible, setBaseEditing, ungroupSelected }) {
  const topMenuToggleButton = document.getElementById('top-menu-toggle');
  const topMenu = document.getElementById('top-menu');
  const menuClearButton = document.getElementById('menu-clear');
  const menuSaveButton = document.getElementById('menu-save');
  const menuLoadButton = document.getElementById('menu-load');
  const menuGridInput = document.getElementById('menu-grid');
  const menuEditBaseInput = document.getElementById('menu-edit-base');
  const menuUngroupButton = document.getElementById('menu-ungroup');
  const newSceneButton = document.getElementById('new-scene');
  const saveJsonButton = document.getElementById('save-json');
  const loadJsonButton = document.getElementById('load-json');

  function close() {
    topMenu.hidden = true;
  }

  topMenuToggleButton.addEventListener('click', () => {
    topMenu.hidden = !topMenu.hidden;
  });

  menuClearButton.addEventListener('click', () => {
    close();
    newSceneButton.click();
  });

  menuSaveButton.addEventListener('click', () => {
    close();
    saveJsonButton.click();
  });

  menuLoadButton.addEventListener('click', () => {
    close();
    loadJsonButton.click();
  });

  menuGridInput.addEventListener('change', () => {
    setGridVisible(menuGridInput.checked);
  });

  menuEditBaseInput.addEventListener('change', () => {
    setBaseEditing(menuEditBaseInput.checked);
  });

  menuUngroupButton.addEventListener('click', () => {
    close();
    ungroupSelected();
  });

  return {
    setGridChecked: (checked) => {
      menuGridInput.checked = checked;
    },
    setBaseEditingChecked: (checked) => {
      menuEditBaseInput.checked = checked;
    },
  };
}
