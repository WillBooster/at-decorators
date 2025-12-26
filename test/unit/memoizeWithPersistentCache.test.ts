import { setTimeout } from 'node:timers/promises';

import { memoizeWithPersistentCacheFactory } from '../../src/memoizeWithPersistentCache.js';

import { getNextInteger } from './shared.js';

describe('persistent cache', () => {
  const persistentStore = new Map<string, [unknown, number]>();

  function persistCache(persistentKey: string, hash: string, value: unknown, currentTime: number): void {
    console.log(`Persisting ${persistentKey}_${hash}:`, value);
    persistentStore.set(`${persistentKey}_${hash}`, [value, currentTime]);
  }

  function tryReadingCache(persistentKey: string, hash: string): [unknown, number] | undefined {
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

  class Random {
    @memoize('Random.nextInteger')
    nextInteger(): number {
      return getNextInteger();
    }

    @memoize('Random.asyncNextInteger')
    async asyncNextInteger(): Promise<number> {
      await setTimeout(0);
      return getNextInteger();
    }
  }

  const nextIntegerWithPersistence = memoize('nextInteger')((base): number => (base as number) + getNextInteger());
  const nextIntegerWithPersistence2 = memoize('nextInteger2')((base): number => (base as number) + getNextInteger());

  function clearMemoryCaches(): void {
    for (const cache of caches) {
      cache.clear();
    }
  }

  beforeEach(() => {
    persistentStore.clear();
    clearMemoryCaches();
  });

  test('persist cache per method', async () => {
    const random = new Random();
    const initial = random.nextInteger();
    const asyncInitial = await random.asyncNextInteger();
    clearMemoryCaches();

    expect(random.nextInteger()).toBe(initial);

    while (persistentStore.size === 1) {
      await setTimeout(0);
    }

    expect(await random.asyncNextInteger()).toBe(asyncInitial);
    expect(persistentStore.size).toBe(2);
  });

  test('persist cache per function', () => {
    const initial = nextIntegerWithPersistence(100);
    clearMemoryCaches();

    expect(nextIntegerWithPersistence(100)).toBe(initial);
    expect(persistentStore.size).toBe(1);

    expect(nextIntegerWithPersistence2(100)).not.toBe(initial);
    expect(persistentStore.size).toBe(2);
  });

  test('remove expired cache', async () => {
    const initial = nextIntegerWithPersistence(100);
    clearMemoryCaches();

    expect(persistentStore.size).toBe(1);
    await setTimeout(400);
    const second = nextIntegerWithPersistence(100);
    expect(second).not.toBe(initial);
    expect(persistentStore.size).toBe(1);
  });

  test('handle multiple cache entries', () => {
    const value1 = nextIntegerWithPersistence(100);
    const value2 = nextIntegerWithPersistence(200);
    clearMemoryCaches();

    expect(persistentStore.size).toBe(2);
    expect(nextIntegerWithPersistence(100)).toBe(value1);
    expect(nextIntegerWithPersistence(200)).toBe(value2);
  });

  test('remove oldest cache entry when maxCacheSizePerTarget is reached', () => {
    const withSizeLimit = memoizeWithPersistentCacheFactory({
      persistCache,
      tryReadingCache,
      removeCache,
      maxCacheSizePerTarget: 2,
    })('nextInteger')((base): number => (base as number) + getNextInteger());

    const value1 = withSizeLimit(100);
    const value2 = withSizeLimit(200);
    const value3 = withSizeLimit(300);
    clearMemoryCaches();

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
  })('nextInteger')((base): number => (base as number) + getNextInteger());

  test('ignore errors in persistCache, tryReadingCache and removeCache', () => {
    expect(() => nextIntegerWithErrorHandling(100)).not.toThrow();
  });
});

async function asyncErrorThrowingPersistCache(): Promise<never> {
  await setTimeout(0);
  throw new Error('Persist error');
}

async function asyncErrorThrowingRemoveCache(): Promise<never> {
  await setTimeout(0);
  throw new Error('Remove error');
}

describe('async error handling in cache operations', () => {
  const nextIntegerWithAsyncErrorHandling = memoizeWithPersistentCacheFactory({
    persistCache: asyncErrorThrowingPersistCache,
    tryReadingCache: errorThrowingTryReadingCache,
    removeCache: asyncErrorThrowingRemoveCache,
    cacheDuration: 200,
  })('nextInteger')((base): number => (base as number) + getNextInteger());

  test('ignore errors in async persistCache, non-async tryReadingCache and async removeCache', async () => {
    await setTimeout(0);
    expect(() => nextIntegerWithAsyncErrorHandling(100)).not.toThrow();
  });
});
