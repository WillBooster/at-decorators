import { cyrb64HashWithLength } from './hash.js';

/**
 * A memoization decorator/function that caches the results of method/getter/function calls to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache size is limited by two parameters in `memoizeFactory` function: `maxCachedThisSize` (10 by default) and `maxCachedValueSize` (10 by default).
 * `maxCachedThisSize` limits the number of distinct `this` contexts that can be cached.
 * `maxCachedValueSize` limits the number of distinct return values that can be cached for each `this` context.
 * When the cache size for either parameter exceeds its limit, the oldest cached value is removed.
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
 * Factory function to create a memoize function with custom cache sizes.
 *
 * @template This - The type of the `this` context within the method, getter or function.
 * @template Args - The types of the arguments to the method, getter or function.
 * @template Return - The return type of the method, getter or function.
 * @param {Object} options - The options for the memoize function.
 * @param {number} [options.maxCachedThisSize=10] - The maximum number of distinct `this` contexts that can be cached.
 * @param {number} [options.maxCachedArgsSize=100] - The maximum number of distinct return values that can be cached for each `this` context.
 * @param {number} [options.cacheDuration=Number.POSITIVE_INFINITY] - The maximum number of milliseconds that a cached value is valid.
 * @param {Function} [options.calcKey] - A function to calculate the cache key for a given set of arguments. Defaults to hashing the stringified arguments.
 * @param {Map<unknown, unknown>[]} [options.caches] - An array of maps to store cached values.
 * @returns {Function} A new memoize function with the specified cache sizes.
 */
export function memoizeFactory({
  cacheDuration = Number.POSITIVE_INFINITY,
  caches,
  calcKey = (args) => cyrb64HashWithLength(JSON.stringify(args)),
  maxCachedArgsSize = 100,
  maxCachedThisSize = 10,
}: {
  maxCachedArgsSize?: number;
  maxCachedThisSize?: number;
  cacheDuration?: number;
  calcKey?: (args: unknown) => string;
  caches?: Map<unknown, unknown>[];
} = {}) {
  return function memoize<This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
    context?:
      | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
      | ClassGetterDecoratorContext<This, Return>
  ): (this: This, ...args: Args) => Return {
    if (context?.kind === 'getter') {
      const cacheByThis = new Map<This, [Return, number]>();
      caches?.push(cacheByThis);
      return function (this: This): Return {
        console.log(`Entering getter ${String(context.name)}.`);

        const now = Date.now();
        if (cacheByThis.has(this)) {
          const [cache, cachedAt] = cacheByThis.get(this) as [Return, number];
          if (now - cachedAt <= cacheDuration) {
            console.log(`Exiting getter ${String(context.name)}.`);
            return cache;
          }
        }

        const result = (target as (this: This) => Return).call(this);
        if (cacheByThis.size >= maxCachedThisSize) {
          const oldestKey = cacheByThis.keys().next().value;
          cacheByThis.delete(oldestKey);
        }
        cacheByThis.set(this, [result, now]);
        console.log(`Exiting getter ${String(context.name)}.`);
        return result as Return;
      };
    } else {
      const cacheByThis = new Map<This, Map<string, [Return, number]>>();
      caches?.push(cacheByThis);

      return function (this: This, ...args: Args): Return {
        console.log(`Entering ${context ? `method ${String(context.name)}` : 'function'}(${calcKey(args)}).`);

        const key = calcKey(args);

        // If `target` is a function outside a class, `this` is undefined.
        let cacheByArgs = cacheByThis.get(this);
        const now = Date.now();
        if (cacheByArgs) {
          if (cacheByArgs.has(key)) {
            const [cache, cachedAt] = cacheByArgs.get(key) as [Return, number];
            if (now - cachedAt <= cacheDuration) {
              console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
              return cache;
            }
          }
        } else {
          cacheByArgs = new Map<string, [Return, number]>();
          if (cacheByThis.size >= maxCachedThisSize) {
            const oldestKey = cacheByThis.keys().next().value;
            cacheByThis.delete(oldestKey);
          }
          cacheByThis.set(this, cacheByArgs);
        }

        const result = context
          ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
          : (target as (...args: Args) => Return)(...args);
        if (cacheByArgs.size >= maxCachedArgsSize) {
          const oldestKey = cacheByArgs.keys().next().value;
          cacheByArgs.delete(oldestKey);
        }
        cacheByArgs.set(key, [result, now]);

        console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
        return result as Return;
      };
    }
  };
}
