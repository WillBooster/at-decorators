import { setTimeout } from 'node:timers/promises';

import { memoizeWithPersistentCacheFactory } from '../../src/memoizeWithPersistentCache.js';

import { getNextInteger } from './shared.js';

describe('persistent cache', () => {
  const persistentStore = new Map<string, [number, unknown]>();

  function persistCache(persistentKey: string, hash: string, currentTime: number, value: unknown): void {
    persistentStore.set(`${persistentKey}_${hash}`, [currentTime, value]);
  }

  function tryReadingCache(persistentKey: string, hash: string): [number, unknown] | undefined {
    return persistentStore.get(`${persistentKey}_${hash}`);
  }

  function removeCache(persistentKey: string, hash: string): void {
    persistentStore.delete(`${persistentKey}_${hash}`);
  }

  const caches: Map<string, [unknown, number]>[] = [];
  const memoize = memoizeWithPersistentCacheFactory({
    caches,
    persistCache,
    tryReadingCache,
    removeCache,
    cacheDuration: 200,
  });
  const nextIntegerWithPersistence = memoize('nextInteger')((base: number = 0): number => base + getNextInteger());
  const nextIntegerWithPersistence2 = memoize('nextInteger2')((base: number = 0): number => base + getNextInteger());

  function clearCache(): void {
    for (const cache of caches) {
      cache.clear();
    }
  }

  beforeEach(() => {
    persistentStore.clear();
    clearCache();
  });

  test('persist cache per method', () => {
    const initial = nextIntegerWithPersistence(100);
    clearCache();

    expect(nextIntegerWithPersistence(100)).toBe(initial);
    expect(persistentStore.size).toBe(1);

    expect(nextIntegerWithPersistence2(100)).not.toBe(initial);
    expect(persistentStore.size).toBe(2);
  });

  test('remove expired cache', async () => {
    const initial = nextIntegerWithPersistence(100);
    clearCache();

    expect(persistentStore.size).toBe(1);
    await setTimeout(400);
    const second = nextIntegerWithPersistence(100);
    expect(second).not.toBe(initial);
    expect(persistentStore.size).toBe(1);
  });

  test('handle multiple cache entries', () => {
    const value1 = nextIntegerWithPersistence(100);
    const value2 = nextIntegerWithPersistence(200);
    clearCache();

    expect(persistentStore.size).toBe(2);
    expect(nextIntegerWithPersistence(100)).toBe(value1);
    expect(nextIntegerWithPersistence(200)).toBe(value2);
  });

  test('remove oldest cache entry when maxCachedArgsSize is reached', () => {
    const withSizeLimit = memoizeWithPersistentCacheFactory({
      persistCache,
      tryReadingCache,
      removeCache,
      maxCachedArgsSize: 2,
    })('nextInteger')((base: number = 0): number => base + getNextInteger());

    const value1 = withSizeLimit(100);
    const value2 = withSizeLimit(200);
    const value3 = withSizeLimit(300);
    clearCache();

    expect(persistentStore.size).toBe(2);
    expect(withSizeLimit(300)).toBe(value3);
    expect(withSizeLimit(200)).toBe(value2);
    expect(withSizeLimit(100)).not.toBe(value1);
  });
});

function errorThrowingPersistCache(): never {
  throw new Error('Persist error');
}

function errorThrowingTryReadingCache(): never {
  throw new Error('Read error');
}

function errorThrowingRemoveCache(): never {
  throw new Error('Remove error');
}

describe('error handling in cache operations', () => {
  const nextIntegerWithErrorHandling = memoizeWithPersistentCacheFactory({
    persistCache: errorThrowingPersistCache,
    tryReadingCache: errorThrowingTryReadingCache,
    removeCache: errorThrowingRemoveCache,
    cacheDuration: 200,
  })('nextInteger')((base: number = 0): number => base + getNextInteger());

  test('ignore errors in persistCache, tryReadingCache and removeCache', () => {
    expect(() => nextIntegerWithErrorHandling(100)).not.toThrow();
  });
});

async function asyncErrorThrowingPersistCache(): Promise<never> {
  throw new Error('Persist error');
}

async function asyncErrorThrowingRemoveCache(): Promise<never> {
  throw new Error('Remove error');
}

describe('async error handling in cache operations', () => {
  const nextIntegerWithAsyncErrorHandling = memoizeWithPersistentCacheFactory({
    persistCache: asyncErrorThrowingPersistCache,
    tryReadingCache: errorThrowingTryReadingCache,
    removeCache: asyncErrorThrowingRemoveCache,
    cacheDuration: 200,
  })('nextInteger')((base: number = 0): number => base + getNextInteger());

  test('ignore errors in async persistCache, non-async tryReadingCache and async removeCache', async () => {
    expect(() => nextIntegerWithAsyncErrorHandling(100)).not.toThrow();
  });
});
