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
      store[name] = [];
    }
  }

  return store as Record<Name, MemoizeCache[]>;
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
  return typeof store === 'object' && store !== null && !Array.isArray(store);
}
