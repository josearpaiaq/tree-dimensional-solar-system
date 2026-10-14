import { describe, expect, it } from 'vitest';
import SaveStore, { SAVE_KEY, freshSave } from './SaveStore.ts';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwingStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
} as unknown as Storage;

describe('SaveStore', () => {
  it('round-trips the codex', () => {
    const store = new SaveStore(memoryStorage());
    store.save({ version: 1, codex: ['earth', 'moon'] });
    expect(store.load().codex).toEqual(['earth', 'moon']);
  });

  it('missing save → fresh', () => {
    expect(new SaveStore(memoryStorage()).load()).toEqual(freshSave());
  });

  it('corrupt JSON → fresh', () => {
    expect(new SaveStore(memoryStorage({ [SAVE_KEY]: '{oops' })).load()).toEqual(freshSave());
  });

  it('unknown version or shape → fresh', () => {
    expect(new SaveStore(memoryStorage({ [SAVE_KEY]: '{"version":99,"codex":[]}' })).load()).toEqual(freshSave());
    expect(new SaveStore(memoryStorage({ [SAVE_KEY]: '{"version":1,"codex":"earth"}' })).load()).toEqual(freshSave());
  });

  it('drops non-string codex entries', () => {
    expect(new SaveStore(memoryStorage({ [SAVE_KEY]: '{"version":1,"codex":["earth",4,null]}' })).load().codex).toEqual(['earth']);
  });

  it('throwing or absent storage never throws', () => {
    const store = new SaveStore(throwingStorage);
    expect(store.load()).toEqual(freshSave());
    expect(() => store.save(freshSave())).not.toThrow();
    expect(new SaveStore(null).load()).toEqual(freshSave());
  });
});
