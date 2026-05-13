import { loadState, serializeState } from './store.js';

export function createHistory({ onRestore }) {
  const undoStack = [];
  const redoStack = [];

  function record() {
    const snapshot = serializeState();

    if (undoStack[undoStack.length - 1] === snapshot) {
      return;
    }

    undoStack.push(snapshot);
    redoStack.length = 0;
  }

  function restore(snapshot) {
    loadState(JSON.parse(snapshot));
    onRestore?.();
  }

  function undo() {
    if (undoStack.length === 0) {
      return false;
    }

    redoStack.push(serializeState());
    restore(undoStack.pop());
    return true;
  }

  function redo() {
    if (redoStack.length === 0) {
      return false;
    }

    undoStack.push(serializeState());
    restore(redoStack.pop());
    return true;
  }

  return {
    record,
    undo,
    redo,
  };
}
