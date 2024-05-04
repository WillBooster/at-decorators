import { memoizeOne, memoizeOneFactory } from '../../src/memoizeOne.js';

import { getNextInteger } from './shared.js';

abstract class Random {
  _count: number;

  constructor(initialCount = 1) {
    this._count = initialCount;
  }

  @memoizeOne
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

const nextInteger1 = memoizeOne((base: number = 0): number => base + getNextInteger());
const nextInteger2 = memoizeOneFactory({ cacheDuration: -1 })((base: number = 0): number => base + getNextInteger());

test.each([
  ['with', (...args: number[]) => random1.nextInteger(...args)],
  ['without', (...args: number[]) => nextInteger1(...args)],
])('memoizeOne function %s decorator', (_, func) => {
  expect(func()).toBe(func());
  expect(func(100)).toBe(func(100));
  expect(func(0)).not.toBe(func(100));

  const cache1 = func();
  const cache2 = func(100);
  expect(cache1).not.toBe(func());
  expect(cache2).not.toBe(func(100));
});

test('memoize method per instance', () => {
  expect(random1.nextInteger()).not.toBe(random2.nextInteger());
  expect(random1.nextInteger(100)).not.toBe(random2.nextInteger(100));
});

test('memoizeOne getter per instance', () => {
  expect(random1.count).toBe(1);
  expect(random1.count).toBe(1);
  expect(random2.count).toBe(10);
  expect(random2.count).toBe(10);
});

test('memoizeFactory with 0 cacheDuration', () => {
  expect(nextInteger2()).not.toBe(nextInteger2());
  expect(nextInteger2(100)).not.toBe(nextInteger2(100));
});
