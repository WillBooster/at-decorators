import { memoizeOne } from '../../src/memoizeOne.js';

class Random {
  @memoizeOne
  nextInteger(inclusiveMinInteger = 0, exclusiveMaxInteger = 100): number {
    return Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger);
  }
}
const random = new Random();

const nextInteger = memoizeOne((inclusiveMinInteger: number = 0, exclusiveMaxInteger: number = 100): number =>
  Math.floor(inclusiveMinInteger + Math.random() * exclusiveMaxInteger)
);

test.each([
  ['decorator', (...args: number[]) => random.nextInteger(...args)],
  ['function', (...args: number[]) => nextInteger(...args)],
])('memoizeOne %s', (_, func) => {
  expect(func()).toBe(func());
  expect(func(100)).toBe(func(100));
  expect(func(0)).not.toBe(func(100));

  const cache1 = func();
  const cache2 = func(100);
  expect(cache1).not.toBe(func());
  expect(cache2).not.toBe(func(100));
});
