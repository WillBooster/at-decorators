import { test, expect } from 'vitest';

import { memoizeOne } from '../../src/index.js';
import { memoize, memoizeFactory } from '../../src/memoize.js';

import { getNextInteger } from './shared.js';

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
const nextInteger2 = memoizeFactory(10, 10, -1)((base: number = 0): number => base + getNextInteger());

test.each([
  ['with', (...args: number[]) => random1.nextInteger(...args)],
  ['without', (...args: number[]) => nextInteger1(...args)],
])('memoize function %s decorator', (_, func) => {
  expect(func()).toBe(func());
  expect(func(100)).toBe(func(100));
  expect(func(0)).not.toBe(func(100));
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

const memoizeOneValue = memoizeFactory(Number.MAX_SAFE_INTEGER, 1);
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
