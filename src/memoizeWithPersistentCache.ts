import { getCacheKeyOfHash } from './getCacheKey.js';

/**
 * Factory function to create a memoize function with custom cache sizes.
 *
 * @template This - The type of the `this` context within the method, getter or function.
 * @template Args - The types of the arguments to the method, getter or function.
 * @template Return - The return type of the method, getter or function.
 * @param {Object} options - The options for the memoize function.
 * @param {number} [options.maxCacheSizePerTarget=100] - The maximum number of distinct values that can be cached.
 * @param {number} [options.cacheDuration=Number.POSITIVE_INFINITY] - The maximum number of milliseconds that a cached value is valid.
 * @param {Function} [options.getCacheKey] - A function to calculate the cache key for a given context and arguments. Defaults to hashing the stringified context and arguments.
 * @param {Map<string, [unknown, number]>[]} [options.caches] - An array of maps to store cached values.
 * @param {Function} options.persistCache - A function to store cached values with current time persistently.
 * @param {Function} options.tryReadingCache - A function to try reading cached values from persistent storage.
 * @param {Function} options.removeCache - A function to remove cached values.
 * @returns {Function} A new memoize function with the specified cache sizes.
 */
export function memoizeWithPersistentCacheFactory({
  cacheDuration = Number.POSITIVE_INFINITY,
  caches,
  getCacheKey = getCacheKeyOfHash,
  maxCacheSizePerTarget = 100,
  persistCache,
  removeCache,
  tryReadingCache,
}: {
  cacheDuration?: number;
  caches?: Map<string, [unknown, number]>[];
  getCacheKey?: (self: unknown, args: unknown[]) => string;
  maxCacheSizePerTarget?: number;
  persistCache: (persistentKey: string, hash: string, value: unknown, currentTime: number) => unknown;
  removeCache: (persistentKey: string, hash: string) => unknown;
  tryReadingCache: (persistentKey: string, hash: string) => [unknown, number] | undefined;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <This, Args extends any[], Return>(persistentKey: string) {
    return function memoize(
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

            // Check in-memory cache first
            if (cache.has(hash)) {
              const [cachedValue, cachedAt] = cache.get(hash) as [Return, number];
              if (now - cachedAt <= cacheDuration) {
                return cachedValue;
              }

              cache.delete(hash);
              try {
                const promise = removeCache(persistentKey, hash);
                if (promise instanceof Promise) promise.catch(noop);
              } catch {
                // do nothing.
              }
            }

            // Try reading from persistent cache
            try {
              const persistentCache = tryReadingCache(persistentKey, hash);
              if (persistentCache) {
                const [cachedValue, cachedAt] = persistentCache;
                if (now - cachedAt <= cacheDuration) {
                  cache.set(hash, [cachedValue as Return, cachedAt]);
                  return cachedValue as Return;
                }

                const promise = removeCache(persistentKey, hash);
                if (promise instanceof Promise) promise.catch(noop);
              }
            } catch {
              // do nothing.
            }

            const result = (target as (this: This) => Return).call(this);
            if (cache.size >= maxCacheSizePerTarget) {
              const oldestKey = cache.keys().next().value as string;
              cache.delete(oldestKey);
              try {
                const promise = removeCache(persistentKey, oldestKey);
                if (promise instanceof Promise) promise.catch(noop);
              } catch {
                // do nothing.
              }
            }
            cache.set(hash, [result, now]);
            if (result instanceof Promise) {
              void (async () => {
                try {
                  const promise = persistCache(persistentKey, hash, await result, now);
                  if (promise instanceof Promise) promise.catch(noop);
                } catch {
                  // do nothing.
                }
              })();
            } else {
              try {
                const promise = persistCache(persistentKey, hash, result, now);
                if (promise instanceof Promise) promise.catch(noop);
              } catch {
                // do nothing.
              }
            }

            return result;
          }
        : function (this: This, ...args: { [K in keyof Args]: Args[K] }) {
            const hash = getCacheKey(this, args);
            const now = Date.now();

            // Check in-memory cache first
            if (cache.has(hash)) {
              const [cachedValue, cachedAt] = cache.get(hash) as [Return, number];
              if (now - cachedAt <= cacheDuration) {
                return cachedValue;
              }

              cache.delete(hash);
              try {
                const promise = removeCache(persistentKey, hash);
                if (promise instanceof Promise) promise.catch(noop);
              } catch {
                // do nothing.
              }
            }

            // Try reading from persistent cache
            try {
              const persistentCache = tryReadingCache(persistentKey, hash);
              if (persistentCache) {
                const [cachedValue, cachedAt] = persistentCache;
                if (now - cachedAt <= cacheDuration) {
                  cache.set(hash, [cachedValue as Return, cachedAt]);
                  return cachedValue as Return;
                }

                const promise = removeCache(persistentKey, hash);
                if (promise instanceof Promise) promise.catch(noop);
              }
            } catch {
              // do nothing.
            }

            const result = context
              ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
              : (target as (...args: Args) => Return)(...args);

            if (cache.size >= maxCacheSizePerTarget) {
              const oldestKey = cache.keys().next().value as string;
              cache.delete(oldestKey);
              try {
                const promise = removeCache(persistentKey, oldestKey);
                if (promise instanceof Promise) promise.catch(noop);
              } catch {
                // do nothing.
              }
            }
            cache.set(hash, [result, now]);
            if (result instanceof Promise) {
              void (async () => {
                try {
                  const promise = persistCache(persistentKey, hash, await result, now);
                  if (promise instanceof Promise) promise.catch(noop);
                } catch {
                  // do nothing.
                }
              })();
            } else {
              try {
                const promise = persistCache(persistentKey, hash, result, now);
                if (promise instanceof Promise) promise.catch(noop);
              } catch {
                // do nothing.
              }
            }

            return result;
          };
    };
  };
}

const noop = (): void => {};
