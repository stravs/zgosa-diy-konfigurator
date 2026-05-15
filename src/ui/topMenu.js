export function createTopMenu({ setGridVisible, setBaseEditing, ungroupSelected }) {
  const topMenuToggleButton = document.getElementById('top-menu-toggle');
  const titleButton = document.querySelector('.topbar h1');
  const topMenu = document.getElementById('top-menu');
  const menuClearButton = document.getElementById('menu-clear');
  const menuSaveButton = document.getElementById('menu-save');
  const menuLoadButton = document.getElementById('menu-load');
  const menuGridInput = document.getElementById('menu-grid');
  const menuEditBaseInput = document.getElementById('menu-edit-base');
  const newSceneButton = document.getElementById('new-scene');
  const saveJsonButton = document.getElementById('save-json');
  const loadJsonButton = document.getElementById('load-json');
  let swipeStartY = null;

  function close() {
    topMenu.hidden = true;
    document.body.classList.remove('show-top-drawer');
  }

  function toggle() {
    topMenu.hidden = !topMenu.hidden;
    document.body.classList.toggle('show-top-drawer', !topMenu.hidden);
  }

  topMenuToggleButton.addEventListener('click', toggle);
  titleButton?.addEventListener('click', toggle);

  function startSwipe(event) {
    if (event.pointerType !== 'touch') {
      return;
    }

    swipeStartY = event.clientY;
  }

  function finishSwipe(event) {
    if (swipeStartY === null || event.pointerType !== 'touch') {
      return;
    }

    const deltaY = event.clientY - swipeStartY;
    swipeStartY = null;

    if (deltaY > 24) {
      topMenu.hidden = false;
      document.body.classList.add('show-top-drawer');
    } else if (deltaY < -24) {
      close();
    }
  }

  titleButton?.addEventListener('pointerdown', startSwipe);
  topMenu.addEventListener('pointerdown', startSwipe);
  titleButton?.addEventListener('pointerup', finishSwipe);
  topMenu.addEventListener('pointerup', finishSwipe);
  titleButton?.addEventListener('pointercancel', () => { swipeStartY = null; });
  topMenu.addEventListener('pointercancel', () => { swipeStartY = null; });

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

  return {
    setGridChecked: (checked) => {
      menuGridInput.checked = checked;
    },
    setBaseEditingChecked: (checked) => {
      menuEditBaseInput.checked = checked;
    },
  };
}
