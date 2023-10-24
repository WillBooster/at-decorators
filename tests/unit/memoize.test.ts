import { memoize, memoizeFunction } from '../../src/memoize.js';

class Random {
  @memoize
  nextInteger(inclusiveMinInteger = 0, exclusiveMaxInteger = 100): number {
    return Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger);
  }
}
const random = new Random();

test('memoize decorator', () => {
  expect(random.nextInteger()).toBe(random.nextInteger());
  expect(random.nextInteger(100)).toBe(random.nextInteger(100));
  expect(random.nextInteger(0)).not.toBe(random.nextInteger(100));
});

const nextInteger = memoizeFunction((inclusiveMinInteger: number = 0, exclusiveMaxInteger: number = 100): number =>
  Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger)
);

test('memoize function', () => {
  expect(nextInteger()).toBe(nextInteger());
  expect(nextInteger(100)).toBe(nextInteger(100));
  expect(nextInteger(0)).not.toBe(nextInteger(100));
});
