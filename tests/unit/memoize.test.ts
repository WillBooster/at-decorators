import { setTimeout } from 'node:timers/promises';

import { memoizeOne } from '../../src/index.js';
import { memoize, memoizeFactory } from '../../src/memoize.js';

import { getNextInteger } from './shared.js';

describe('memory cache', () => {
  abstract class Random {
    _count: number;

    constructor(initialCount = 1) {
      this._count = initialCount;
    }

    @memoize
    nextInteger(base = 0): number {
      return base + getNextInteger();
    }

    abstract get count(): number;
  }

  class RandomChild extends Random {
    @memoizeOne
    get count(): number {
      return this._count++;
    }
  }

  const random1 = new RandomChild();
  const random2 = new RandomChild(10);

  const nextInteger1 = memoize((base: number = 0): number => base + getNextInteger());
  const nextInteger2 = memoizeFactory({ maxCachedArgsSize: 10, cacheDuration: -1 })(
    (base: number = 0): number => base + getNextInteger()
  );
  const nextInteger3 = memoizeFactory({ cacheDuration: 200 })((base: number = 0): number => base + getNextInteger());
  const asyncNextInteger = memoize(async (base: number = 0): Promise<number> => {
    await setTimeout(0);
    return base + getNextInteger();
  });

  test.each([
    ['with', (...args: number[]) => random1.nextInteger(...args)],
    ['without', (...args: number[]) => nextInteger1(...args)],
  ])('memoize function %s decorator', (_, func) => {
    expect(func()).toBe(func());
    expect(func(100)).toBe(func(100));
    expect(func(0)).not.toBe(func(100));
  });

  test('memoize async function', async () => {
    expect(typeof (await asyncNextInteger())).toBe('number');
    expect(await asyncNextInteger()).toBe(await asyncNextInteger());
    expect(await asyncNextInteger(100)).toBe(await asyncNextInteger(100));
    expect(await asyncNextInteger(0)).not.toBe(await asyncNextInteger(100));
  });

  test('memoize async function with exception', async () => {
    const asyncErrorFunction = memoize(async () => {
      await setTimeout(0);
      throw new Error('Test error');
    });

    await expect(asyncErrorFunction()).rejects.toThrow('Test error');
  });

  test('memoize method per instance', () => {
    expect(random1.nextInteger()).not.toBe(random2.nextInteger());
    expect(random1.nextInteger(100)).not.toBe(random2.nextInteger(100));
  });

  test('memoize getter per instance', () => {
    expect(random1.count).toBe(1);
    expect(random1.count).toBe(1);
    expect(random2.count).toBe(10);
    expect(random2.count).toBe(10);
  });

  test('memoizeFactory with 0 cacheDuration', () => {
    expect(nextInteger2()).not.toBe(nextInteger2());
    expect(nextInteger2(100)).not.toBe(nextInteger2(100));
  });

  test('memoizeFactory with 200 cacheDuration', async () => {
    const initial = nextInteger3();
    expect(nextInteger3()).toBe(initial);
    expect(nextInteger3()).toBe(initial);
    await setTimeout(400);
    const second = nextInteger3();
    expect(second).not.toBe(initial);
    expect(nextInteger3()).toBe(second);
    expect(nextInteger3()).toBe(second);
  });

  const memoizeOneValue = memoizeFactory({ maxCachedArgsSize: 1 });
  class Klass {
    @memoizeOneValue
    get obj(): Record<string, string> {
      return {};
    }
  }

  test('memoizeOneValue', () => {
    const k = new Klass();
    expect(k.obj).toEqual({});
    k.obj['a'] = 'b';
    expect(k.obj).toEqual({ a: 'b' });
  });
});

describe('persistent cache', () => {
  const persistentStore = new Map<string, [number, unknown]>();

  function persistCache(hash: string, currentTime: number, value: unknown): void {
    persistentStore.set(hash, [currentTime, value]);
  }

  function tryReadingCache(hash: string): [number, unknown] | undefined {
    return persistentStore.get(hash);
  }

  function removeCache(hash: string): void {
    persistentStore.delete(hash);
  }

  const caches: Map<unknown, unknown>[] = [];
  const nextIntegerWithPersistence = memoizeFactory({
    caches,
    persistCache,
    tryReadingCache,
    removeCache,
    cacheDuration: 200,
  })((base: number = 0): number => base + getNextInteger());

  function clearCache(): void {
    for (const cache of caches) {
      cache.clear();
    }
  }

  beforeEach(() => {
    persistentStore.clear();
    clearCache();
  });

  test('should use persistent cache', () => {
    const initial = nextIntegerWithPersistence(100);
    clearCache();

    expect(nextIntegerWithPersistence(100)).toBe(initial);
    expect(persistentStore.size).toBe(1);
  });

  test('should remove expired cache', async () => {
    const initial = nextIntegerWithPersistence(100);
    clearCache();

    expect(persistentStore.size).toBe(1);
    await setTimeout(400);
    const second = nextIntegerWithPersistence(100);
    expect(second).not.toBe(initial);
    expect(persistentStore.size).toBe(1);
  });

  test('should handle multiple cache entries', () => {
    const value1 = nextIntegerWithPersistence(100);
    const value2 = nextIntegerWithPersistence(200);
    clearCache();

    expect(persistentStore.size).toBe(2);
    expect(nextIntegerWithPersistence(100)).toBe(value1);
    expect(nextIntegerWithPersistence(200)).toBe(value2);
  });

  test('should remove oldest cache entry when maxCachedArgsSize is reached', () => {
    const withSizeLimit = memoizeFactory({
      persistCache,
      tryReadingCache,
      removeCache,
      maxCachedArgsSize: 2,
    })((base: number = 0): number => base + getNextInteger());

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
  const nextIntegerWithErrorHandling = memoizeFactory({
    persistCache: errorThrowingPersistCache,
    tryReadingCache: errorThrowingTryReadingCache,
    removeCache: errorThrowingRemoveCache,
    cacheDuration: 200,
  })((base: number = 0): number => base + getNextInteger());

  test('should ignore errors in persistCache, tryReadingCache and removeCache', () => {
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
  const nextIntegerWithAsyncErrorHandling = memoizeFactory({
    persistCache: asyncErrorThrowingPersistCache,
    tryReadingCache: errorThrowingTryReadingCache,
    removeCache: asyncErrorThrowingRemoveCache,
    cacheDuration: 200,
  })((base: number = 0): number => base + getNextInteger());

  test('should ignore errors in async persistCache, non-async tryReadingCache and async removeCache', async () => {
    expect(() => nextIntegerWithAsyncErrorHandling(100)).not.toThrow();
  });
});
