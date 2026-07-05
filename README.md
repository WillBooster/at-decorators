# at-decorators

[![Test](https://github.com/WillBooster/at-decorators/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/at-decorators/actions/workflows/test.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

[![npm version](https://img.shields.io/npm/v/at-decorators.svg)](https://www.npmjs.com/package/at-decorators)
[![license](https://img.shields.io/npm/l/at-decorators.svg)](https://github.com/WillBooster/at-decorators/blob/main/LICENSE)

:wrench: Fast, dependency-free memoization for TypeScript, built on [TC39 Stage 3 decorators](https://github.com/tc39/proposal-decorators) — for class methods, getters, and plain functions.

## Features

- **One API for everything** — apply the same `memoize` to class methods, getters (as a decorator), and standalone functions (as a wrapper).
- **Structure-aware cache keys** — arguments are serialized (including `Map`, `Set`, `Date`, `RegExp`, `URL`, `Error`, `bigint`, and circular references) and hashed with SHA3-512, so structurally equal arguments hit the same cache entry.
- **Expiration and size limits** — per-entry TTL via `cacheDuration` and a FIFO size cap via `maxCacheSizePerTarget`.
- **Explicit invalidation** — group memoized targets into clearable cache groups; caches are tracked via `WeakRef`, so they never leak.
- **Pluggable persistence** — back the in-memory cache with any storage (file, Redis, database) through three small callbacks.
- **Zero runtime dependencies** — ships ESM and CJS with type definitions.

## Installation

```sh
npm install at-decorators # or yarn add / pnpm add / bun add
```

## Quick Start

```ts
import { memoize } from 'at-decorators';

class UserService {
  @memoize
  fetchUser(userId: string): Promise<User> {
    return fetch(`/api/users/${userId}`).then((res) => res.json());
  }

  @memoize
  get config(): Config {
    return loadConfigFromDisk();
  }
}

// Plain functions work too — no decorator syntax required.
const fibonacci = memoize((n: number): number => (n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2)));
```

Repeated calls with structurally equal arguments return the cached result without invoking the original implementation.

## Usage

### Custom cache settings: `memoizeFactory`

Create a `memoize` with your own TTL, size limit, or cache-key derivation:

```ts
import { memoizeFactory } from 'at-decorators';

const memoizeShortly = memoizeFactory({
  cacheDuration: 60 * 1000, // Entries expire after 1 minute (default: no expiration).
  maxCacheSizePerTarget: 100, // Keep at most 100 entries per method/getter/function (default: 10,000). The oldest entry is evicted first.
});

class ExchangeRateService {
  @memoizeShortly
  getRate(from: string, to: string): Promise<number> {
    return fetchRate(from, to);
  }
}
```

| Option                  | Default                                     | Description                                                                     |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `cacheDuration`         | `Number.POSITIVE_INFINITY`                  | Milliseconds a cached value stays valid.                                        |
| `maxCacheSizePerTarget` | `10_000`                                    | Maximum entries per memoized target; the oldest entry is evicted when exceeded. |
| `getCacheKey`           | [`getCacheKeyOfHash`](#cache-key-functions) | Derives a string cache key from `this` and the arguments.                       |
| `caches`                | `undefined`                                 | A registry that receives every created cache, for external tracking/clearing.   |

### Caching only the latest result: `memoizeOne`

`memoizeOne` remembers a single entry — ideal when arguments rarely change between consecutive calls and you want O(1) memory:

```ts
import { memoizeOne, memoizeOneWithEmptyHash, memoizeOneFactory } from 'at-decorators';

// Re-computes only when the arguments (or `this`) change.
const formatReport = memoizeOne((rows: Row[]) => rows.map(renderRow).join('\n'));

// Ignores arguments entirely — computes once, then always returns the first result.
const loadSettings = memoizeOneWithEmptyHash(() => JSON.parse(fs.readFileSync('settings.json', 'utf8')));

// With a TTL: at most one re-computation per 5 seconds for the same arguments.
const memoizeOneBriefly = memoizeOneFactory({ cacheDuration: 5000 });
```

### Clearable cache groups: `createMemoizeCacheGroup`

Use `createMemoizeCacheGroup` when a feature needs both a memoized function/decorator and an explicit invalidation hook:

```ts
import { createMemoizeCacheGroup } from 'at-decorators';

const usersCache = createMemoizeCacheGroup({
  cacheDuration: 24 * 60 * 60 * 1000,
  maxCacheSizePerTarget: 10_000,
});

export const memoizeForUsers = usersCache.memoize;
export const clearCachesForUsers = usersCache.clear;
```

Every target memoized with `memoizeForUsers` registers its cache in the group, and `clearCachesForUsers()` empties them all at once. Caches are held via `WeakRef`, so a group never prevents garbage collection of memoized targets.

Use `getGlobalMemoizeCacheStore` when several bundles or module instances (e.g. separately bundled route handlers) must share and clear the same cache groups:

```ts
import { createMemoizeCacheGroup, getGlobalMemoizeCacheStore } from 'at-decorators';

const cacheStore = getGlobalMemoizeCacheStore(Symbol.for('myAppMemoizeCacheStore'), ['headers', 'users'] as const);

const headersCache = createMemoizeCacheGroup({
  cacheDuration: 10 * 60 * 1000,
  caches: cacheStore.headers,
  maxCacheSizePerTarget: 1000,
});

export const memoizeForHeaders = headersCache.memoize;
export const clearCachesForHeaders = headersCache.clear;
```

The store lives on `globalThis` under the given key, so every module instance resolves the same registries. You can also clear an arbitrary collection of caches directly with `clearMemoizeCaches(caches)`.

### Persistent caches: `memoizeWithPersistentCacheFactory`

Keep cached values across process restarts by supplying three storage callbacks. Storage failures are swallowed, so a broken backend degrades to in-memory memoization instead of breaking calls:

```ts
import { memoizeWithPersistentCacheFactory } from 'at-decorators';

const createPersistentMemoize = memoizeWithPersistentCacheFactory({
  cacheDuration: 60 * 60 * 1000,
  // `persistCache` and `removeCache` may be async; their results are ignored.
  persistCache: (persistentKey, hash, value, currentTime) => db.upsert(persistentKey, hash, value, currentTime),
  removeCache: (persistentKey, hash) => db.remove(persistentKey, hash),
  // `tryReadingCache` MUST be synchronous and return [value, cachedAt] or undefined;
  // a Promise cannot be awaited here and would silently bypass the persistent lookup.
  tryReadingCache: (persistentKey, hash) => syncDb.read(persistentKey, hash),
});

class GeocodingService {
  @createPersistentMemoize('geocode')
  geocode(address: string): Promise<Coordinates> {
    return callGeocodingApi(address);
  }
}
```

Each memoized target gets a `persistentKey` namespace. Lookups check the in-memory cache first, then the persistent storage (synchronously — use a synchronous client or an in-process snapshot for reads); promise results are persisted after they resolve.

### Cache key functions

The cache key determines what counts as "the same call". Three implementations are provided, and any `(self, args) => string` works via the `getCacheKey` option:

```ts
import { getCacheKeyOfHash, getCacheKeyOfStringified, getCacheKeyOfEmptyString, memoizeFactory } from 'at-decorators';

// Default: SHA3-512 hash of the serialized `this` and arguments — fixed-length keys.
const memoizeByHash = memoizeFactory({ getCacheKey: getCacheKeyOfHash });

// Serialized `this` and arguments as-is — faster for small arguments, keys grow with input size.
const memoizeByString = memoizeFactory({ getCacheKey: getCacheKeyOfStringified });

// Ignore `this` and arguments — every call shares one cache entry.
const memoizeIgnoringArgs = memoizeFactory({ getCacheKey: getCacheKeyOfEmptyString });

// Custom: key on a single argument property.
const memoizeByUserId = memoizeFactory({ getCacheKey: (_self, args) => (args[0] as { id: string }).id });
```

Serialization is powered by an embedded fork of [oson](https://github.com/KnorpelSenf/oson), which — unlike `JSON.stringify` — handles `undefined`, `bigint`, `NaN`, `Infinity`, `Map`, `Set`, `Date`, `RegExp`, `URL`, `Error`, and circular references (`Uint8Array` is currently supported only when its contents decode to Latin-1 text). The serializer (`stringify`) and hash (`sha3_512`) are exported for direct use.

## API Summary

| Export                                                                        | Kind      | Description                                                           |
| ----------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `memoize`                                                                     | decorator | Memoize with default settings (10,000 entries per target, no TTL).    |
| `memoizeFactory(options)`                                                     | factory   | Build a `memoize` with custom TTL, size limit, key function, caches.  |
| `memoizeOne` / `memoizeOneWithEmptyHash`                                      | decorator | Cache only the latest result (keyed by arguments / shared).           |
| `memoizeOneFactory(options)`                                                  | factory   | Build a `memoizeOne` with custom TTL or key function.                 |
| `createMemoizeCacheGroup(options)`                                            | factory   | A `memoize` plus a `clear()` hook over all its caches.                |
| `getGlobalMemoizeCacheStore(key, names)`                                      | function  | Shared, `globalThis`-backed cache registries for cross-bundle groups. |
| `clearMemoizeCaches(caches)`                                                  | function  | Clear every cache in an iterable of caches.                           |
| `memoizeWithPersistentCacheFactory(options)`                                  | factory   | Memoization backed by user-provided persistent storage.               |
| `getCacheKeyOfHash` / `getCacheKeyOfStringified` / `getCacheKeyOfEmptyString` | function  | Built-in cache-key derivations.                                       |
| `stringify(value)`                                                            | function  | Structure-preserving serialization (oson format).                     |
| `sha3_512(text)`                                                              | function  | SHA3-512 hex digest of a string.                                      |

## Requirements

- **Decorators**: TypeScript 5.0+ (standard decorators, i.e. without `experimentalDecorators`), or Babel with [`@babel/plugin-proposal-decorators`](https://babeljs.io/docs/babel-plugin-proposal-decorators) (`version: '2023-11'`).
- **Runtime**: Node.js 24+ (per the `engines` field); plain-function usage requires no decorator support at all.

## Contributing

Issues and pull requests are welcome. Run `yarn install`, make your changes, and verify with `yarn test` and `yarn verify`.

## License

Apache-2.0 © [WillBooster Inc.](https://willbooster.com/) — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Includes code derived from [oson](https://github.com/KnorpelSenf/oson) (MIT) and [js-sha3](https://github.com/emn178/js-sha3) (MIT).
