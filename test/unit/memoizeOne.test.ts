import { setTimeout } from 'node:timers/promises';

import { getCacheKeyOfEmptyString, getCacheKeyOfHash } from '../../src/getCacheKey.js';
import { memoizeOne, memoizeOneFactory, memoizeOneWithEmptyHash } from '../../src/memoizeOne.js';

import { getNextInteger } from './shared.js';

describe('memoizeOne with getCacheKey which includes this and arguments', () => {
  abstract class Random {
    _count: number;

    constructor(initialCount = 1) {
      this._count = initialCount;
    }

    @memoizeOne
    nextInteger(base = 0): number {
      return this._count * base + getNextInteger();
    }

    abstract get count(): number;
  }

  class RandomChild extends Random {
    @memoizeOne
    get count(): number {
      return this._count++;
    }

    @memoizeOne
    get random(): number {
      return Math.random();
    }
  }

  const random1 = new RandomChild();
  const random2 = new RandomChild(10);

  const nextInteger1 = memoizeOne((base = 1): number => (base as number) + getNextInteger());
  const nextInteger2 = memoizeOneFactory({
    cacheDuration: -1,
    getCacheKey: getCacheKeyOfHash,
  })((base = 1): number => (base as number) + getNextInteger());
  const nextInteger3 = memoizeOneFactory({
    cacheDuration: 200,
    getCacheKey: getCacheKeyOfHash,
  })((base = 1): number => (base as number) + getNextInteger());
  const asyncNextInteger1 = memoizeOne(async (base = 1): Promise<number> => {
    await setTimeout(1);
    return (base as number) + getNextInteger();
  });

  test.each([
    ['with', (...args: number[]) => random1.nextInteger(...args)],
    ['without', (...args: number[]) => nextInteger1(...args)],
  ])('memoize function %s decorator', (_, func) => {
    expect(func()).toBe(func());
    expect(func(100)).toBe(func(100));
    expect(func(1)).not.toBe(func(100));

    const cache1 = func();
    const cache2 = func(100);
    expect(cache1).not.toBe(func());
    expect(cache2).not.toBe(func(100));
  });

  test('memoize async function', async () => {
    expect(typeof (await asyncNextInteger1())).toBe('number');
    expect(await asyncNextInteger1()).toBe(await asyncNextInteger1());
    expect(await asyncNextInteger1(100)).toBe(await asyncNextInteger1(100));
    expect(await asyncNextInteger1(1)).not.toBe(await asyncNextInteger1(100));
  });

  test('memoize method per instance', () => {
    expect(random1.nextInteger()).not.toBe(random2.nextInteger());
    expect(random1.nextInteger(100)).not.toBe(random2.nextInteger(100));
  });

  test('memoize getter per instance', () => {
    expect(random1.random).toBe(random1.random);
    expect(random2.random).toBe(random2.random);
    expect(random1.random).not.toBe(random2.random);
  });

  test('memoizeFactory with -1 cacheDuration', () => {
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

  test('memoize async function with exception', async () => {
    const asyncErrorFunction = memoizeOne(async () => {
      await setTimeout(1);
      throw new Error('Test error');
    });

    await expect(asyncErrorFunction()).rejects.toThrow('Test error');
  });
});

describe('memoizeOneWithEmptyHash (memoizeOne with empty hash)', () => {
  abstract class Random {
    _count: number;

    constructor(initialCount = 1) {
      this._count = initialCount;
    }

    @memoizeOneWithEmptyHash
    nextInteger(base = 1): number {
      return this._count * base + getNextInteger();
    }

    abstract get count(): number;
  }

  class RandomChild extends Random {
    @memoizeOneWithEmptyHash
    get count(): number {
      return this._count++;
    }
  }

  const random1 = new RandomChild();
  const random2 = new RandomChild(10);

  const nextInteger1 = memoizeOneWithEmptyHash((base = 1): number => (base as number) + getNextInteger());
  const nextInteger2 = memoizeOneFactory({ cacheDuration: -1, getCacheKey: getCacheKeyOfEmptyString })(
    (base = 1): number => (base as number) + getNextInteger()
  );
  const nextInteger3 = memoizeOneFactory({ cacheDuration: 200, getCacheKey: getCacheKeyOfEmptyString })(
    (base = 1): number => (base as number) + getNextInteger()
  );
  const asyncNextInteger1 = memoizeOneWithEmptyHash(async (base = 1): Promise<number> => {
    await setTimeout(1);
    return (base as number) + getNextInteger();
  });

  test('memoize function with decorator', () => {
    expect(random1.nextInteger()).toBe(random1.nextInteger());
    expect(random1.nextInteger(100)).toBe(random1.nextInteger(100));
    expect(random1.nextInteger(1)).toBe(random1.nextInteger(100));

    const cache1 = random1.nextInteger();
    const cache2 = random1.nextInteger(100);
    expect(cache1).toBe(random1.nextInteger());
    expect(cache2).toBe(random1.nextInteger(100));
  });

  test('memoize function without decorator', () => {
    expect(nextInteger1()).toBe(nextInteger1());
    expect(nextInteger1(100)).toBe(nextInteger1(100));
    expect(nextInteger1(1)).toBe(nextInteger1(100));

    const cache1 = nextInteger1();
    const cache2 = nextInteger1(100);
    expect(cache1).toBe(nextInteger1());
    expect(cache2).toBe(nextInteger1(100));
  });

  test("don't invalidate cache when fields change", () => {
    const first = random1.nextInteger();
    random1._count++;
    expect(random1.nextInteger()).toBe(first);
  });

  test('memoize async function', async () => {
    expect(typeof (await asyncNextInteger1())).toBe('number');
    expect(await asyncNextInteger1()).toBe(await asyncNextInteger1());
    expect(await asyncNextInteger1(100)).toBe(await asyncNextInteger1(100));
    expect(await asyncNextInteger1(1)).toBe(await asyncNextInteger1(100));
  });

  test('memoize method ignoring instance difference', () => {
    expect(random1.nextInteger()).toBe(random2.nextInteger());
    expect(random1.nextInteger(100)).toBe(random2.nextInteger(100));
  });

  test('memoize getter ignoring instance difference', () => {
    expect(random1.count).toBe(random1.count);
    expect(random2.count).toBe(random2.count);
    expect(random1.count).toBe(random2.count);
  });

  test('memoizeFactory with -1 cacheDuration', () => {
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

  test('memoize async function with exception', async () => {
    const asyncErrorFunction = memoizeOne(async () => {
      await setTimeout(1);
      throw new Error('Test error');
    });

    await expect(asyncErrorFunction()).rejects.toThrow('Test error');
  });
});
