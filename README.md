# at-decorators

[![Test](https://github.com/WillBooster/at-decorators/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/at-decorators/actions/workflows/test.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

:wrench: A set of general-purpose decorators written in TypeScript following [tc39/proposal-decorators (Stage 3)](https://github.com/tc39/proposal-decorators).

## Clearable memoize groups

Use `createMemoizeCacheGroup` when a feature needs both a memoized function/decorator and an explicit invalidation hook.

```ts
import { createMemoizeCacheGroup } from 'at-decorators';

const usersCache = createMemoizeCacheGroup({
  cacheDuration: 24 * 60 * 60 * 1000,
  maxCacheSizePerTarget: 10_000,
});

export const memoizeForUsers = usersCache.memoize;
export const clearCachesForUsers = usersCache.clear;
```

Use `getGlobalMemoizeCacheStore` when several route bundles or module instances must clear the same cache groups.

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
