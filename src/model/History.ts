export interface HistoryEntry<T> {
  before: T;
  after: T;
}

export class History<T> {
  private static readonly MAX_UNDO = 100;
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];

  push(entry: HistoryEntry<T>): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > History.MAX_UNDO) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): T | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return entry.before;
  }

  redo(): T | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return entry.after;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
