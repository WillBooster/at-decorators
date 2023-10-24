import { memoize } from '../../src/memoize.js';

class Random {
  _count = 1;

  @memoize
  nextInteger(inclusiveMinInteger = 0, exclusiveMaxInteger = 100): number {
    return Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger);
  }

  @memoize
  get count(): number {
    return this._count++;
  }
}
const random = new Random();

const nextInteger = memoize((inclusiveMinInteger: number = 0, exclusiveMaxInteger: number = 100): number =>
  Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger)
);

test.each([
  ['with', (...args: number[]) => random.nextInteger(...args)],
  ['without', (...args: number[]) => nextInteger(...args)],
])('memoize function %s decorator', (_, func) => {
  expect(func()).toBe(func());
  expect(func(100)).toBe(func(100));
  expect(func(0)).not.toBe(func(100));
});

test('memoize getter', () => {
  expect(random.count).toBe(random.count);
});
