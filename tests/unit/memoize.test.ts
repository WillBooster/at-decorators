import { memoize } from '../../src/memoize.js';

import { getNextInteger } from './shared.js';

class Random {
  _count: number;

  constructor(initialCount = 1) {
    this._count = initialCount;
  }

  @memoize
  nextInteger(base = 0): number {
    return base + getNextInteger();
  }

  @memoize
  get count(): number {
    return this._count++;
  }
}
const random1 = new Random();
const random2 = new Random(10);

const nextInteger = memoize((inclusiveMinInteger: number = 0, exclusiveMaxInteger: number = 100): number =>
  Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger)
);

test.each([
  ['with', (...args: number[]) => random1.nextInteger(...args)],
  ['without', (...args: number[]) => nextInteger(...args)],
])('memoize function %s decorator', (_, func) => {
  expect(func()).toBe(func());
  expect(func(100)).toBe(func(100));
  expect(func(0)).not.toBe(func(100));
});

test('memoize function per instance', () => {
  expect(random1.nextInteger()).not.toBe(random2.nextInteger());
  expect(random1.nextInteger(100)).not.toBe(random2.nextInteger(100));
});

test('memoize getter per instance', () => {
  expect(random1.count).toBe(1);
  expect(random1.count).toBe(1);
  expect(random2.count).toBe(10);
  expect(random2.count).toBe(10);
});
