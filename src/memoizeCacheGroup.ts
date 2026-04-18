import { memoizeFactory, type MemoizeCache, type MemoizeCacheRegistry } from './memoize.js';

const MEMOIZE_CACHE_STORE_MARK = Symbol.for('at-decorators.memoizeCacheStore');

export interface MemoizeCacheGroup {
  readonly caches: MemoizeCacheRegistry;
  readonly clear: () => void;
  readonly memoize: ReturnType<typeof memoizeFactory>;
}

export type MemoizeCacheGroupOptions = Omit<NonNullable<Parameters<typeof memoizeFactory>[0]>, 'caches'> & {
  caches?: MemoizeCacheRegistry;
};

export function createMemoizeCacheGroup(options: MemoizeCacheGroupOptions = {}): MemoizeCacheGroup {
  const { caches = createWeakMemoizeCacheList(), ...memoizeOptions } = options;

  return {
    caches,
    clear: () => {
      clearMemoizeCaches(caches);
    },
    memoize: memoizeFactory({ ...memoizeOptions, caches }),
  };
}

export function clearMemoizeCaches(caches: Iterable<MemoizeCache>): void {
  for (const cache of caches) {
    cache.clear();
  }
}

export function getGlobalMemoizeCacheStore<const Name extends string>(
  globalKey: string | symbol,
  names: readonly Name[]
): Record<Name, MemoizeCacheRegistry> {
  const store = getOrCreateGlobalStore(globalKey);

  for (const name of names) {
    const cacheGroup = store[name];
    if (!isMemoizeCacheRegistry(cacheGroup)) {
      store[name] = createWeakMemoizeCacheList();
    }
  }

  return store as Record<Name, MemoizeCacheRegistry>;
}

function createWeakMemoizeCacheList(): MemoizeCacheRegistry {
  const cacheRefs: WeakRef<MemoizeCache>[] = [];

  return {
    get length() {
      pruneCollectedCaches(cacheRefs);
      return cacheRefs.length;
    },
    push: (...caches: MemoizeCache[]) => {
      pruneCollectedCaches(cacheRefs);
      for (const cache of caches) {
        cacheRefs.push(new WeakRef(cache));
      }
      return cacheRefs.length;
    },
    *[Symbol.iterator]() {
      for (const cache of getAliveCaches(cacheRefs)) {
        yield cache;
      }
    },
  };
}

function getOrCreateGlobalStore(globalKey: string | symbol): Record<string, MemoizeCacheRegistry> {
  const globalWithCacheStore = globalThis as typeof globalThis & Record<PropertyKey, unknown>;
  const store = globalWithCacheStore[globalKey];
  if (isMemoizeCacheStore(store)) {
    return store;
  }

  if (store !== undefined) {
    throw new Error(`Global memoize cache store key is already occupied: ${String(globalKey)}`);
  }

  const newStore: Record<string, MemoizeCacheRegistry> = {};
  Object.defineProperty(newStore, MEMOIZE_CACHE_STORE_MARK, {
    value: true,
  });
  globalWithCacheStore[globalKey] = newStore;

  return newStore;
}

function isMemoizeCacheStore(store: unknown): store is Record<string, MemoizeCacheRegistry> {
  if (typeof store !== 'object' || store === null || Array.isArray(store)) {
    return false;
  }

  return (store as Record<PropertyKey, unknown>)[MEMOIZE_CACHE_STORE_MARK] === true;
}

function isMemoizeCacheRegistry(value: unknown): value is MemoizeCacheRegistry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const registry = value as Partial<MemoizeCacheRegistry>;
  return (
    typeof registry.length === 'number' &&
    typeof registry.push === 'function' &&
    typeof registry[Symbol.iterator] === 'function'
  );
}

function getAliveCaches(cacheRefs: WeakRef<MemoizeCache>[]): MemoizeCache[] {
  const caches: MemoizeCache[] = [];

  for (let i = cacheRefs.length - 1; i >= 0; i--) {
    const cache = cacheRefs[i]?.deref();
    if (cache) {
      caches.push(cache);
    } else {
      cacheRefs.splice(i, 1);
    }
  }

  return caches.toReversed();
}

function pruneCollectedCaches(cacheRefs: WeakRef<MemoizeCache>[]): void {
  for (let i = cacheRefs.length - 1; i >= 0; i--) {
    if (!cacheRefs[i]?.deref()) {
      cacheRefs.splice(i, 1);
    }
  }
}
