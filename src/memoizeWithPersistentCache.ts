import { getCacheKeyOfHash } from './getCacheKey.js';
import type { GetCacheKey, MemoizeCacheRegistry } from './memoize.js';

type MaybePromise<T> = T | PromiseLike<T>;

export interface MemoizeWithPersistentCacheOptions {
  cacheDuration?: number;
  caches?: MemoizeCacheRegistry;
  getCacheKey?: GetCacheKey;
  maxCacheSizePerTarget?: number;
  persistCache: (persistentKey: string, hash: string, value: unknown, currentTime: number) => MaybePromise<unknown>;
  removeCache: (persistentKey: string, hash: string) => MaybePromise<unknown>;
  tryReadingCache: (persistentKey: string, hash: string) => [unknown, number] | undefined;
}

export interface MemoizeWithPersistentCache {
  <This, Args extends unknown[], Return>(
    target: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
  ): (this: This, ...args: Args) => Return;
  <This, Return>(
    target: (this: This) => Return,
    context: ClassGetterDecoratorContext<This, Return>
  ): (this: This) => Return;
  <Args extends unknown[], Return>(target: (...args: Args) => Return): (...args: Args) => Return;
}

/**
 * Factory function to create a memoize function with custom cache sizes.
 *
 * @template This - The type of the `this` context within the method, getter or function.
 * @template Args - The types of the arguments to the method, getter or function.
 * @template Return - The return type of the method, getter or function.
 * @param {Object} options - The options for the memoize function.
 * @param {number} [options.maxCacheSizePerTarget=10000] - The maximum number of distinct values that can be cached.
 * @param {number} [options.cacheDuration=Number.POSITIVE_INFINITY] - The maximum number of milliseconds that a cached value is valid.
 * @param {Function} [options.getCacheKey] - A function to calculate the cache key for a given context and arguments. Defaults to hashing the stringified context and arguments.
 * @param {MemoizeCacheRegistry} [options.caches] - A registry to store cached values.
 * @param {Function} options.persistCache - A function to store cached values with current time persistently.
 * @param {Function} options.tryReadingCache - A function to try reading cached values from persistent storage.
 * @param {Function} options.removeCache - A function to remove cached values.
 * @returns {Function} A new memoize function with the specified cache sizes.
 */
export function memoizeWithPersistentCacheFactory({
  cacheDuration = Number.POSITIVE_INFINITY,
  caches,
  getCacheKey = getCacheKeyOfHash,
  maxCacheSizePerTarget = 10_000,
  persistCache,
  removeCache,
  tryReadingCache,
}: MemoizeWithPersistentCacheOptions): (persistentKey: string) => MemoizeWithPersistentCache {
  return function (persistentKey: string) {
    return function memoize(
      target: ((this: unknown, ...args: unknown[]) => unknown) | ((...args: unknown[]) => unknown),
      context?:
        | ClassMethodDecoratorContext<unknown, (this: unknown, ...args: unknown[]) => unknown>
        | ClassGetterDecoratorContext<unknown, unknown>
    ) {
      const cache = new Map<string, [unknown, number]>();
      caches?.push(cache);

      return context?.kind === 'getter'
        ? function (this: unknown) {
            const hash = getCacheKey(this, []);
            const now = Date.now();
            const cacheEntry = cache.get(hash);

            // Check in-memory cache first
            if (cacheEntry) {
              const [cachedValue, cachedAt] = cacheEntry;
              if (now - cachedAt <= cacheDuration) {
                return cachedValue;
              }

              cache.delete(hash);
              ignoreCacheOperationError(() => removeCache(persistentKey, hash));
            }

            // Try reading from persistent cache
            try {
              const persistentCache = tryReadingCache(persistentKey, hash);
              if (persistentCache) {
                const [cachedValue, cachedAt] = persistentCache;
                if (now - cachedAt <= cacheDuration) {
                  cache.set(hash, [cachedValue, cachedAt]);
                  return cachedValue;
                }

                ignoreCacheOperationError(() => removeCache(persistentKey, hash));
              }
            } catch {
              // do nothing.
            }

            const result = (target as (this: unknown) => unknown).call(this);
            if (cache.size >= maxCacheSizePerTarget) {
              const oldestKey = cache.keys().next().value as string;
              cache.delete(oldestKey);
              ignoreCacheOperationError(() => removeCache(persistentKey, oldestKey));
            }
            cache.set(hash, [result, now]);
            if (isPromiseLike(result)) {
              void (async () => {
                ignoreCacheOperationError(async () => persistCache(persistentKey, hash, await result, now));
              })();
            } else {
              ignoreCacheOperationError(() => persistCache(persistentKey, hash, result, now));
            }

            return result;
          }
        : function (this: unknown, ...args: unknown[]) {
            const hash = getCacheKey(this, args);
            const now = Date.now();
            const cacheEntry = cache.get(hash);

            // Check in-memory cache first
            if (cacheEntry) {
              const [cachedValue, cachedAt] = cacheEntry;
              if (now - cachedAt <= cacheDuration) {
                return cachedValue;
              }

              cache.delete(hash);
              ignoreCacheOperationError(() => removeCache(persistentKey, hash));
            }

            // Try reading from persistent cache
            try {
              const persistentCache = tryReadingCache(persistentKey, hash);
              if (persistentCache) {
                const [cachedValue, cachedAt] = persistentCache;
                if (now - cachedAt <= cacheDuration) {
                  cache.set(hash, [cachedValue, cachedAt]);
                  return cachedValue;
                }

                ignoreCacheOperationError(() => removeCache(persistentKey, hash));
              }
            } catch {
              // do nothing.
            }

            const result = context
              ? (target as (this: unknown, ...args: unknown[]) => unknown).call(this, ...args)
              : (target as (...args: unknown[]) => unknown)(...args);

            if (cache.size >= maxCacheSizePerTarget) {
              const oldestKey = cache.keys().next().value as string;
              cache.delete(oldestKey);
              ignoreCacheOperationError(() => removeCache(persistentKey, oldestKey));
            }
            cache.set(hash, [result, now]);
            if (isPromiseLike(result)) {
              void (async () => {
                ignoreCacheOperationError(async () => persistCache(persistentKey, hash, await result, now));
              })();
            } else {
              ignoreCacheOperationError(() => persistCache(persistentKey, hash, result, now));
            }

            return result;
          };
    } as MemoizeWithPersistentCache;
  };
}

function ignoreCacheOperationError(operation: () => MaybePromise<unknown>): void {
  try {
    const result = operation();
    if (isPromiseLike(result)) {
      void result.then(undefined, noop);
    }
  } catch {
    // do nothing.
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function') ||
    (typeof value === 'function' && 'then' in value && typeof value.then === 'function')
  );
}

function noop(): void {}
