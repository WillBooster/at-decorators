import { sha3_512 } from './hash.js';

let globalCounter = 0;

/**
 * A memoization decorator/function that caches the results of method/getter/function calls to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache size is limited by `maxCachedArgsSize` parameter (100 by default) in `memoizeFactory` function.
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
export const memoize = memoizeFactory({
  persistCache: () => {},
  removeCache: () => {},
  tryReadingCache: () => undefined
});

/**
 * Factory function to create a memoize function with custom cache sizes.
 *
 * @template This - The type of the `this` context within the method, getter or function.
 * @template Args - The types of the arguments to the method, getter or function.
 * @template Return - The return type of the method, getter or function.
 * @param {Object} options - The options for the memoize function.
 * @param {number} [options.maxCachedArgsSize=100] - The maximum number of distinct values that can be cached.
 * @param {number} [options.cacheDuration=Number.POSITIVE_INFINITY] - The maximum number of milliseconds that a cached value is valid.
 * @param {Function} [options.calcHash] - A function to calculate the hash for a given context and arguments. Defaults to hashing the stringified context and arguments.
 * @param {Map<unknown, unknown>[]} [options.caches] - An array of maps to store cached values.
 * @param {Function} options.persistCache - A function to store cached values persistently.
 * @param {Function} options.tryReadingCache - A function to try reading cached values from persistent storage.
 * @param {Function} options.removeCache - A function to remove cached values.
 * @returns {Function} A new memoize function with the specified cache sizes.
 */
export function memoizeFactory({
  cacheDuration = Number.POSITIVE_INFINITY,
  caches,
  calcHash = (self, counter, args) => sha3_512(JSON.stringify([self, counter, args])),
  maxCachedArgsSize = 100,
  persistCache,
  removeCache,
  tryReadingCache,
}: {
  maxCachedArgsSize?: number;
  cacheDuration?: number;
  calcHash?: (self: unknown, counter: number, args: unknown) => string;
  caches?: Map<string, [unknown, number]>[];
  persistCache: (hash: string, currentTime: number, value: unknown) => void;
  tryReadingCache: (hash: string) => [number, unknown] | undefined;
  removeCache: (hash: string) => void;
}) {
  return function memoize<This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
    context?:
      | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
      | ClassGetterDecoratorContext<This, Return>
  ): (this: This, ...args: Args) => Return {
    const counter = globalCounter++;
    if (context?.kind === 'getter') {
      const cache = new Map<string, [Return, number]>();
      caches?.push(cache);
      return function (this: This): Return {
        console.log(`Entering getter ${String(context.name)}.`);

        const hash = calcHash(this, counter, []);
        const now = Date.now();

        // Check in-memory cache first
        if (cache.has(hash)) {
          const [cachedValue, cachedAt] = cache.get(hash) as [Return, number];
          if (now - cachedAt <= cacheDuration) {
            console.log(`Exiting getter ${String(context.name)}.`);
            return cachedValue;
          }

          cache.delete(hash);
          try {
            const promise = removeCache(hash) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          } catch {
            // do nothing.
          }
        }

        // Try reading from persistent cache
        try {
          const persistentCache = tryReadingCache(hash);
          if (persistentCache) {
            const [cachedAt, cachedValue] = persistentCache;
            if (now - cachedAt <= cacheDuration) {
              cache.set(hash, [cachedValue as Return, cachedAt]);
              console.log(`Exiting getter ${String(context.name)}.`);
              return cachedValue as Return;
            }

            const promise = removeCache(hash) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          }
        } catch {
          // do nothing.
        }

        const result = (target as (this: This) => Return).call(this);
        if (cache.size >= maxCachedArgsSize) {
          const oldestKey = cache.keys().next().value as string;
          cache.delete(oldestKey);
          try {
            const promise = removeCache(oldestKey) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          } catch {
            // do nothing.
          }
        }
        cache.set(hash, [result, now]);
        if (result instanceof Promise) {
          void (async () => {
            try {
              const promise = persistCache(hash, now, result) as unknown;
              if (promise instanceof Promise) promise.catch(noop);
            } catch {
              // do nothing.
            }
          });
        } else {
          try {
            const promise = persistCache(hash, now, result) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          } catch {
            // do nothing.
          }
        }

        console.log(`Exiting getter ${String(context.name)}.`);
        return result as Return;
      };
    } else {
      const cache = new Map<string, [Return, number]>();
      caches?.push(cache);

      return function (this: This, ...args: Args): Return {
        console.log(
          `Entering ${context ? `method ${String(context.name)}` : 'function'}(${calcHash(this, counter, args)}).`
        );

        const hash = calcHash(this, counter, args);
        const now = Date.now();

        // Check in-memory cache first
        if (cache.has(hash)) {
          const [cachedValue, cachedAt] = cache.get(hash) as [Return, number];
          if (now - cachedAt <= cacheDuration) {
            console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
            return cachedValue;
          }

          cache.delete(hash);
          try {
            const promise = removeCache(hash) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          } catch {
            // do nothing.
          }
        }

        // Try reading from persistent cache
        try {
          const persistentCache = tryReadingCache(hash);
          if (persistentCache) {
            const [cachedAt, cachedValue] = persistentCache;
            if (now - cachedAt <= cacheDuration) {
              cache.set(hash, [cachedValue as Return, cachedAt]);
              console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
              return cachedValue as Return;
            }

            const promise = removeCache(hash) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          }
        } catch {
          // do nothing.
        }

        const result = context
          ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
          : (target as (...args: Args) => Return)(...args);

        if (cache.size >= maxCachedArgsSize) {
          const oldestKey = cache.keys().next().value as string;
          cache.delete(oldestKey);
          try {
            const promise = removeCache(oldestKey) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          } catch {
            // do nothing.
          }
        }
        cache.set(hash, [result, now]);
        if (result instanceof Promise) {
          void (async () => {
            try {
              const promise = persistCache(hash, now, result) as unknown;
              if (promise instanceof Promise) promise.catch(noop);
            } catch {
              // do nothing.
            }
          });
        } else {
          try {
            const promise = persistCache(hash, now, result) as unknown;
            if (promise instanceof Promise) promise.catch(noop);
          } catch {
            // do nothing.
          }
        }

        console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
        return result;
      };
    }
  };
}

const noop = (): void => {};
