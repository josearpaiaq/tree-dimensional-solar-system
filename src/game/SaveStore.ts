export const SAVE_KEY = 'solar-pilot-save';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  codex: string[];
}

export function freshSave(): SaveData {
  return { version: SAVE_VERSION, codex: [] };
}

// Upgrades any older save shape to the current one. Part 2 adds a v1 → v2
// step here so existing Codex progress survives. Anything unrecognizable
// becomes a fresh save rather than an error.
export function migrate(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return freshSave();
  const { version, codex } = raw as { version?: unknown; codex?: unknown };
  if (version !== SAVE_VERSION || !Array.isArray(codex)) return freshSave();
  return { version: SAVE_VERSION, codex: codex.filter((id): id is string => typeof id === 'string') };
}

// localStorage can be missing, blocked (private mode), full, or hold
// garbage. None of that may ever stop play, so every failure falls back to
// a fresh save and is otherwise ignored.
export default class SaveStore {
  private _storage: Storage | null;

  constructor(storage: Storage | null = defaultStorage()) {
    this._storage = storage;
  }

  load(): SaveData {
    try {
      const text = this._storage?.getItem(SAVE_KEY);
      return text ? migrate(JSON.parse(text)) : freshSave();
    } catch {
      return freshSave();
    }
  }

  save(data: SaveData): void {
    try {
      this._storage?.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Unavailable or full storage: progress just won't persist this session.
    }
  }
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
