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
export const memoize = memoizeFactory(10, 10);

/**
 * Factory function to create a memoize function with custom cache sizes.
 *
 * @param {number} maxCachedThisSize - The maximum number of distinct `this` contexts that can be cached.
 * @param {number} maxCachedValueSize - The maximum number of distinct return values that can be cached for each `this` context.
 *
 * @returns {Function} A new memoize function with the specified cache sizes.
 */
export function memoizeFactory(maxCachedThisSize: number, maxCachedValueSize: number) {
  return function memoize<This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
    context?:
      | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
      | ClassGetterDecoratorContext<This, Return>
  ): (this: This, ...args: Args) => Return {
    if (context?.kind === 'getter') {
      const cacheByThis = new Map<This, Return>();
      return function (this: This): Return {
        console.log(`Entering getter ${String(context.name)}.`);

        let result;
        if (cacheByThis.has(this)) {
          result = cacheByThis.get(this) as Return;
        } else {
          result = (target as (this: This) => Return).call(this);
          if (cacheByThis.size >= maxCachedThisSize) {
            const oldestKey = cacheByThis.keys().next().value;
            cacheByThis.delete(oldestKey);
          }
          cacheByThis.set(this, result);
        }

        console.log(`Exiting getter ${String(context.name)}.`);
        return result;
      };
    } else {
      const cacheByThis = new Map<This, Map<string, Return>>();

      return function (this: This, ...args: Args): Return {
        console.log(`Entering ${context ? `method ${String(context.name)}` : 'function'}(${JSON.stringify(args)}).`);

        const key = JSON.stringify(args);

        let cache = cacheByThis.get(this);
        if (cache) {
          if (cache.has(key)) {
            console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
            return cache.get(key) as Return;
          }
        } else {
          cache = new Map<string, Return>();
          if (cacheByThis.size >= maxCachedThisSize) {
            const oldestKey = cacheByThis.keys().next().value;
            cacheByThis.delete(oldestKey);
          }
          cacheByThis.set(this, cache);
        }

        const result = context
          ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
          : (target as (...args: Args) => Return)(...args);
        if (cache.size >= maxCachedValueSize) {
          const oldestKey = cache.keys().next().value;
          cache.delete(oldestKey);
        }
        cache.set(key, result);

        console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
        return result;
      };
    }
  };
}
