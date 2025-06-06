import { getCacheKeyOfHash } from './getCacheKey.js';

/**
 * A memoization decorator/function that caches the results of method/getter/function calls to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache size is limited by `maxCacheSizePerTarget` parameter (100 by default) in `memoizeFactory` function.
 * When the cache size exceeds its limit, the oldest cached value is removed.
 *
 * @template This The type of the `this` context within the method, getter or function.
 * @template Args The types of the arguments to the method, getter or function.
 * @template Return The return type of the method, getter or function.
 *
 * @param {Function | keyof This} target The method, function or the name of getter to be memoized.
 * @param {ClassMethodDecoratorContext | ClassGetterDecoratorContext} [context] The context in which the decorator is being applied. Optional for standard functions.
 *
 * @returns {Function} A new function that wraps the original method or getter, function with caching logic.
 */
export const memoize = memoizeFactory();

/**
 * Factory function to create a memoize function with custom cache settings.
 *
 * @template This - The type of the `this` context within the method, getter or function.
 * @template Args - The types of the arguments to the method, getter or function.
 * @template Return - The return type of the method, getter or function.
 * @param {Object} options - The options for the memoize function.
 * @param {number} [options.maxCacheSizePerTarget=10000] - The maximum number of distinct values that can be cached.
 * @param {number} [options.cacheDuration=Number.POSITIVE_INFINITY] - The maximum number of milliseconds that a cached value is valid.
 * @param {Function} [options.getCacheKey] - A function to calculate the cache key for a given context and arguments. Defaults to hashing the stringified context and arguments.
 * @param {Map<string, [unknown, number]>[]} [options.caches] - An array of maps to store cached values. Useful for tracking and clearing caches externally.
 * @returns {Function} A new memoize function with the specified cache settings.
 */
export function memoizeFactory({
  cacheDuration = Number.POSITIVE_INFINITY,
  caches,
  getCacheKey = getCacheKeyOfHash,
  maxCacheSizePerTarget = 10_000,
}: {
  cacheDuration?: number;
  caches?: Map<string, [unknown, number]>[];
  getCacheKey?: (self: unknown, args: unknown[]) => string;
  maxCacheSizePerTarget?: number;
} = {}) {
  return function memoize<This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
    context?:
      | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
      | ClassGetterDecoratorContext<This, Return>
  ) {
    const cache = new Map<string, [Return, number]>();
    caches?.push(cache);

    return context?.kind === 'getter'
      ? function (this: This) {
          const hash = getCacheKey(this, []);
          const now = Date.now();

          if (cache.has(hash)) {
            const [cachedValue, cachedAt] = cache.get(hash) as [Return, number];
            if (now - cachedAt <= cacheDuration) {
              return cachedValue;
            }
            cache.delete(hash);
          }

          const result = (target as (this: This) => Return).call(this);
          if (cache.size >= maxCacheSizePerTarget) {
            const oldestKey = cache.keys().next().value as string;
            cache.delete(oldestKey);
          }
          cache.set(hash, [result, now]);

          return result;
        }
      : function (this: This, ...args: Args) {
          const hash = getCacheKey(this, args);
          const now = Date.now();

          if (cache.has(hash)) {
            const [cachedValue, cachedAt] = cache.get(hash) as [Return, number];
            if (now - cachedAt <= cacheDuration) {
              return cachedValue;
            }
            cache.delete(hash);
          }

          const result = context
            ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
            : (target as (...args: Args) => Return)(...args);

          if (cache.size >= maxCacheSizePerTarget) {
            const oldestKey = cache.keys().next().value as string;
            cache.delete(oldestKey);
          }
          cache.set(hash, [result, now]);

          return result;
        };
  };
}
