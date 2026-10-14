export interface CodexOptions {
  onUnlock?: (bodyId: string) => void;
}

// The set of cataloged (scanned) bodies — the player's progress in Part 1.
export default class Codex {
  private _cataloged: Set<string>;
  private _onUnlock: (bodyId: string) => void;

  constructor(initial: Iterable<string> = [], { onUnlock }: CodexOptions = {}) {
    this._cataloged = new Set(initial);
    this._onUnlock = onUnlock ?? (() => {});
  }

  has(bodyId: string): boolean {
    return this._cataloged.has(bodyId);
  }

  get size(): number {
    return this._cataloged.size;
  }

  // Returns true only the first time a body is cataloged.
  add(bodyId: string): boolean {
    if (this._cataloged.has(bodyId)) return false;
    this._cataloged.add(bodyId);
    this._onUnlock(bodyId);
    return true;
  }

  toArray(): string[] {
    return [...this._cataloged];
  }
}
