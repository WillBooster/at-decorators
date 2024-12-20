import { setTimeout } from 'node:timers/promises';

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
const nextInteger3 = memoizeOneFactory({ cacheDuration: 200 })((base: number = 0): number => base + getNextInteger());
const asyncNextInteger = memoizeOne(async (base: number = 0): Promise<number> => {
  await setTimeout(0);
  return base + getNextInteger();
});

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

test('memoize async function', async () => {
  expect(typeof (await asyncNextInteger())).toBe('number');
  expect(await asyncNextInteger()).toBe(await asyncNextInteger());
  expect(await asyncNextInteger(100)).toBe(await asyncNextInteger(100));
  expect(await asyncNextInteger(0)).not.toBe(await asyncNextInteger(100));
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

test('memoizeOne async function with exception', async () => {
  const asyncErrorFunction = memoizeOne(async () => {
    await setTimeout(0);
    throw new Error('Test error');
  });

  await expect(asyncErrorFunction()).rejects.toThrow('Test error');
});
