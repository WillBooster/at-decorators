import { getCacheKeyOfEmptyString, getCacheKeyOfHash } from './getCacheKey.js';

/**
 * A memoization decorator/function that caches the results of the latest method/getter/function call to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache only stores the latest value. When a new value is computed, the previous cached value is replaced.
 * Uses SHA3-512 hashing of the stringified context and arguments as cache key.
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
export const memoizeOne = memoizeOneFactory({ getCacheKey: getCacheKeyOfHash });

/**
 * A memoization decorator/function that caches the results of the latest method/getter/function call to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache only stores the latest value. When a new value is computed, the previous cached value is replaced.
 * Uses an empty string as cache key, meaning all calls share the same cache regardless of context or arguments.
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
export const memoizeOneWithEmptyHash = memoizeOneFactory({ getCacheKey: getCacheKeyOfEmptyString });

/**
 * A factory function to create a memoizeOne function with custom cache settings.
 *
 * @param {Object} options - The options for the memoizeOne function.
 * @param {number} [options.cacheDuration=Number.POSITIVE_INFINITY] - The maximum number of milliseconds that a cached value is valid.
 * @param {Function} [options.getCacheKey=getCacheKeyWithContext] - A function to calculate the cache key for a given context and arguments. Defaults to hashing the stringified context and arguments.
 *
 * @returns {Function} A memoizeOne function with the specified cache settings.
 * @template This - The type of the `this` context within the method, getter or function.
 * @template Args - The types of the arguments to the method, getter or function.
 * @template Return - The return type of the method, getter or function.
 */
export function memoizeOneFactory({
  cacheDuration = Number.POSITIVE_INFINITY,
  getCacheKey = getCacheKeyOfHash,
}: { cacheDuration?: number; getCacheKey?: (self: unknown, args: unknown[]) => string } = {}) {
  return function <This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
    context?:
      | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
      | ClassGetterDecoratorContext<This, Return>
  ) {
    let lastCache: Return;
    let lastCachedAt: number;
    let lastHash: string;

    return context?.kind === 'getter'
      ? function (this: This) {
          const hash = getCacheKey(this, []);
          const now = Date.now();
          if (lastHash !== hash || now - lastCachedAt > cacheDuration) {
            lastHash = hash;
            lastCache = (target as (this: This) => Return).call(this);
            lastCachedAt = now;
          }
          return lastCache;
        }
      : function (this: This, ...args: Args) {
          const hash = getCacheKey(this, args);
          const now = Date.now();
          if (lastHash !== hash || now - lastCachedAt > cacheDuration) {
            lastHash = hash;
            lastCache = context
              ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
              : (target as (...args: Args) => Return)(...args);
            lastCachedAt = now;
          }
          return lastCache;
        };
  };
}
