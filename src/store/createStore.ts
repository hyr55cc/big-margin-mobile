import { useSyncExternalStore } from 'react';

/**
 * Minimal selector-based store built on useSyncExternalStore.
 * Dependency-free, synchronous, and optionally persisted to localStorage.
 */

export interface Store<T> {
  <S>(selector: (state: T) => S): S;
  get(): T;
  set(patch: Partial<T> | ((prev: T) => Partial<T>)): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export interface PersistOptions<T> {
  key: string;
  version: number;
  /** Restrict which keys are written to storage. */
  pick?: (keyof T)[];
  /** Migrate an older persisted payload to the current shape. */
  migrate?: (persisted: unknown, fromVersion: number) => Partial<T> | null;
}

const STORAGE_PREFIX = 'bigmargin:';

function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota, private mode, or storage disabled — state stays in memory */
  }
}

export function clearPersistedState(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function createStore<T extends object>(
  initial: T,
  persist?: PersistOptions<T>,
): Store<T> {
  let state: T = initial;

  if (persist && typeof window !== 'undefined') {
    const stored = safeRead(persist.key) as {
      v?: number;
      d?: Partial<T>;
    } | null;
    if (stored && stored.d) {
      if (stored.v === persist.version) {
        state = { ...initial, ...stored.d };
      } else if (persist.migrate) {
        const migrated = persist.migrate(stored.d, stored.v ?? 0);
        if (migrated) state = { ...initial, ...migrated };
      }
    }
  }

  const listeners = new Set<() => void>();

  const flush = () => {
    if (!persist || typeof window === 'undefined') return;
    const data: Partial<T> = persist.pick
      ? persist.pick.reduce((acc, k) => {
          acc[k] = state[k];
          return acc;
        }, {} as Partial<T>)
      : state;
    safeWrite(persist.key, { v: persist.version, d: data });
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const get = () => state;

  const set = (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    let changed = false;
    for (const k of Object.keys(next) as (keyof T)[]) {
      if (!Object.is(state[k], next[k])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...next };
    flush();
    listeners.forEach((l) => l());
  };

  const reset = () => {
    state = initial;
    flush();
    listeners.forEach((l) => l());
  };

  const useStore = (<S,>(selector: (s: T) => S): S =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(initial),
    )) as Store<T>;

  useStore.get = get;
  useStore.set = set;
  useStore.reset = reset;
  useStore.subscribe = subscribe;

  return useStore;
}

/** Stable id generator for locally created records. */
export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
