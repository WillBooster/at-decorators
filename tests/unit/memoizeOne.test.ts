import { setTimeout } from 'node:timers/promises';

import { sha3_512 } from '../../src/hash.js';
import { memoizeOne, memoizeOneFactory } from '../../src/memoizeOne.js';

import { getNextInteger } from './shared.js';

describe('memoizeOne with default calcHash which returns empty string', () => {
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
  }

  const random1 = new RandomChild();
  const random2 = new RandomChild(10);

  const nextInteger1 = memoizeOne((base: number = 0): number => base + getNextInteger());
  const nextInteger2 = memoizeOneFactory({ cacheDuration: -1 })((base: number = 0): number => base + getNextInteger());
  const nextInteger3 = memoizeOneFactory({ cacheDuration: 200 })((base: number = 0): number => base + getNextInteger());
  const asyncNextInteger1 = memoizeOne(async (base: number = 0): Promise<number> => {
    await setTimeout(0);
    return base + getNextInteger();
  });

  test.each([
    ['with', (...args: number[]) => random1.nextInteger(...args)],
    ['without', (...args: number[]) => nextInteger1(...args)],
  ])('memoize function %s decorator', (_, func) => {
    expect(func()).toBe(func());
    expect(func(100)).toBe(func(100));
    expect(func(0)).toBe(func(100));

    const cache1 = func();
    const cache2 = func(100);
    expect(cache1).toBe(func());
    expect(cache2).toBe(func(100));
  });

  test('memoize async function', async () => {
    expect(typeof (await asyncNextInteger1())).toBe('number');
    expect(await asyncNextInteger1()).toBe(await asyncNextInteger1());
    expect(await asyncNextInteger1(100)).toBe(await asyncNextInteger1(100));
    expect(await asyncNextInteger1(0)).toBe(await asyncNextInteger1(100));
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
      await setTimeout(0);
      throw new Error('Test error');
    });

    await expect(asyncErrorFunction()).rejects.toThrow('Test error');
  });
});

describe('with specified calcHash', () => {
  const memoizeOneWithHash = memoizeOneFactory({ calcHash: (self, args) => sha3_512(JSON.stringify([self, args])) });

  abstract class Random {
    _count: number;

    constructor(initialCount = 1) {
      this._count = initialCount;
    }

    @memoizeOneWithHash
    nextInteger(base = 0): number {
      return this._count * base + getNextInteger();
    }

    abstract get count(): number;
  }

  class RandomChild extends Random {
    @memoizeOneWithHash
    get count(): number {
      return this._count++;
    }
  }

  const random1 = new RandomChild();
  const random2 = new RandomChild(10);

  const nextInteger1 = memoizeOneWithHash((base: number = 0): number => base + getNextInteger());
  const nextInteger2 = memoizeOneFactory({
    cacheDuration: -1,
    calcHash: (self, args) => sha3_512(JSON.stringify([self, args])),
  })((base: number = 0): number => base + getNextInteger());
  const nextInteger3 = memoizeOneFactory({
    cacheDuration: 200,
    calcHash: (self, args) => sha3_512(JSON.stringify([self, args])),
  })((base: number = 0): number => base + getNextInteger());
  const asyncNextInteger1 = memoizeOneWithHash(async (base: number = 0): Promise<number> => {
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

    const cache1 = func();
    const cache2 = func(100);
    expect(cache1).not.toBe(func());
    expect(cache2).not.toBe(func(100));
  });

  test('memoize async function', async () => {
    expect(typeof (await asyncNextInteger1())).toBe('number');
    expect(await asyncNextInteger1()).toBe(await asyncNextInteger1());
    expect(await asyncNextInteger1(100)).toBe(await asyncNextInteger1(100));
    expect(await asyncNextInteger1(0)).not.toBe(await asyncNextInteger1(100));
  });

  test('memoize method per instance', () => {
    expect(random1.nextInteger()).not.toBe(random2.nextInteger());
    expect(random1.nextInteger(100)).not.toBe(random2.nextInteger(100));
  });

  test('memoize getter per instance', () => {
    expect(random1.count).not.toBe(random1.count);
    expect(random2.count).not.toBe(random2.count);
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
    const asyncErrorFunction = memoizeOneWithHash(async () => {
      await setTimeout(0);
      throw new Error('Test error');
    });

    await expect(asyncErrorFunction()).rejects.toThrow('Test error');
  });
});
