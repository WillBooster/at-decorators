import { memoizeFactory } from './memoize.js';

export type MemoizeCache = Map<string, [unknown, number]>;

export interface MemoizeCacheGroup {
  readonly caches: MemoizeCache[];
  readonly clear: () => void;
  readonly memoize: ReturnType<typeof memoizeFactory>;
}

export type MemoizeCacheGroupOptions = Omit<NonNullable<Parameters<typeof memoizeFactory>[0]>, 'caches'> & {
  caches?: MemoizeCache[];
};

export function createMemoizeCacheGroup(options: MemoizeCacheGroupOptions = {}): MemoizeCacheGroup {
  const { caches = [], ...memoizeOptions } = options;

  return {
    caches,
    clear: () => {
      clearMemoizeCaches(caches);
    },
    memoize: memoizeFactory({ ...memoizeOptions, caches }),
  };
}

export function clearMemoizeCaches(caches: readonly MemoizeCache[]): void {
  for (const cache of caches) {
    cache.clear();
  }
}

export function getGlobalMemoizeCacheStore<const Name extends string>(
  globalKey: string | symbol,
  names: readonly Name[]
): Record<Name, MemoizeCache[]> {
  const store = getOrCreateGlobalStore(globalKey);

  for (const name of names) {
    const cacheGroup = store[name];
    if (!Array.isArray(cacheGroup)) {
      store[name] = createWeakMemoizeCacheList();
    }
  }

  return store as Record<Name, MemoizeCache[]>;
}

function createWeakMemoizeCacheList(): MemoizeCache[] {
  const cacheRefs: WeakRef<MemoizeCache>[] = [];

  return new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') {
        pruneCollectedCaches(cacheRefs);
        return cacheRefs.length;
      }

      if (property === 'push') {
        return (...caches: MemoizeCache[]) => {
          pruneCollectedCaches(cacheRefs);
          for (const cache of caches) {
            cacheRefs.push(new WeakRef(cache));
          }
          return cacheRefs.length;
        };
      }

      if (property === Symbol.iterator) {
        return function* () {
          for (const cache of getAliveCaches(cacheRefs)) {
            yield cache;
          }
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

function getOrCreateGlobalStore(globalKey: string | symbol): Record<string, MemoizeCache[]> {
  const globalWithCacheStore = globalThis as typeof globalThis & Record<PropertyKey, unknown>;
  const store = globalWithCacheStore[globalKey];
  if (isMemoizeCacheStore(store)) {
    return store;
  }

  const newStore: Record<string, MemoizeCache[]> = {};
  globalWithCacheStore[globalKey] = newStore;

  return newStore;
}

function isMemoizeCacheStore(store: unknown): store is Record<string, MemoizeCache[]> {
  if (typeof store !== 'object' || store === null || Array.isArray(store)) {
    return false;
  }

  return Object.values(store).every(Array.isArray);
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
