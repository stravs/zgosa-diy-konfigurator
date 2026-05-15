import { loadState, serializeState } from './store.js';

const MAX_HISTORY = 20;

export function createHistory({ onRestore }) {
  const undoStack = [];
  const redoStack = [];

  function record() {
    const snapshot = serializeState();

    if (undoStack[undoStack.length - 1] === snapshot) {
      return;
    }

    undoStack.push(snapshot);

    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

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

    if (redoStack.length > MAX_HISTORY) {
      redoStack.shift();
    }

    restore(undoStack.pop());
    return true;
  }

  function redo() {
    if (redoStack.length === 0) {
      return false;
    }

    undoStack.push(serializeState());

    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

    restore(redoStack.pop());
    return true;
  }

  return {
    record,
    undo,
    redo,
  };
}
