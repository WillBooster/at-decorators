import { setTimeout } from 'node:timers/promises';

import { memoize, memoizeFactory } from '../../src/memoize.js';

import { getNextInteger } from './shared.js';

describe('memory cache', () => {
  abstract class Random {
    _count: number;

    constructor(initialCount = 1) {
      this._count = initialCount;
    }

    @memoize
    nextInteger(base = 1): number {
      return this._count * base + getNextInteger();
    }

    @memoize
    nextString(base = 1): string {
      return String(this._count * base + getNextInteger());
    }

    abstract get count(): number;
  }

  class RandomChild extends Random {
    @memoize
    get count(): number {
      return this._count++;
    }

    @memoize
    get random(): number {
      return Math.random();
    }
  }

  const random1 = new RandomChild();
  const random2 = new RandomChild(10);

  const nextInteger1 = memoize((base): number => (base as number) + getNextInteger());
  const nextInteger2 = memoizeFactory({ maxCacheSizePerTarget: 10, cacheDuration: -1 })(
    (base): number => (base as number) + getNextInteger()
  );
  const nextInteger3 = memoizeFactory({ cacheDuration: 200 })((base): number => (base as number) + getNextInteger());
  const asyncNextInteger = memoize(async (base): Promise<number> => {
    await setTimeout(1);
    return (base as number) + getNextInteger();
  });

  test('memoize function with decorator', () => {
    expect(random1.nextInteger()).toBe(random1.nextInteger());
    expect(random1.nextInteger(100)).toBe(random1.nextInteger(100));
    expect(random1.nextInteger(1)).not.toBe(random1.nextInteger(100));
  });

  test('memoize function without decorator', () => {
    expect(nextInteger1()).toBe(nextInteger1());
    expect(nextInteger1(100)).toBe(nextInteger1(100));
    expect(nextInteger1(1)).not.toBe(nextInteger1(100));
  });

  test('invalidate cache when fields change', () => {
    const first = random1.nextInteger();
    random1._count++;
    expect(random1.nextInteger()).not.toBe(first);
  });

  test('invalidate cache when fields change via getter', () => {
    expect(random1.count).not.toBe(random1.count);
    expect(random2.count).not.toBe(random2.count);
  });

  test('memoize async function', async () => {
    expect(typeof (await asyncNextInteger())).toBe('number');
    expect(await asyncNextInteger()).toBe(await asyncNextInteger());
    expect(await asyncNextInteger(100)).toBe(await asyncNextInteger(100));
    expect(await asyncNextInteger(1)).not.toBe(await asyncNextInteger(100));
  });

  test('memoize async function with exception', async () => {
    const asyncErrorFunction = memoize(async () => {
      await setTimeout(1);
      throw new Error('Test error');
    });

    await expect(asyncErrorFunction()).rejects.toThrow('Test error');
  });

  test('memoize method per method', () => {
    expect(random1.nextInteger()).toBe(random1.nextInteger());
    expect(random1.nextInteger(100)).toBe(random1.nextInteger(100));
    expect(random1.nextString()).toBe(random1.nextString());
    expect(random1.nextString(100)).toBe(random1.nextString(100));
    expect(random1.nextInteger()).not.toBe(random1.nextString());
    expect(random1.nextInteger(100)).not.toBe(random1.nextString(100));
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

  const memoizeOneValue = memoizeFactory({ maxCacheSizePerTarget: 1 });
  class Klass {
    @memoizeOneValue
    get obj(): Record<string, string> {
      return {};
    }
  }

  test('memoizeOneValue', () => {
    const k = new Klass();
    expect(k.obj).toEqual({});
    k.obj.a = 'b';
    expect(k.obj).toEqual({ a: 'b' });
  });
});
