import { memoizeOne } from './memoizeOne.js';

const MAX_CACHE_SIZE = 10;

/**
 * A memoization decorator/function that caches the results of method/getter/function calls to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache size is limited to 10. When the cache size exceeds this limit, the oldest cached value is removed.
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
export function memoize<This, Args extends unknown[], Return>(
  target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
  context?:
    | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
    | ClassGetterDecoratorContext<This, Return>
): (this: This, ...args: Args) => Return {
  if (context?.kind === 'getter') {
    return memoizeOne(target, context);
  }

  const cache = new Map<string, Return>();

  return function (this: This, ...args: Args): Return {
    console.log(`Entering ${context ? `method ${String(context.name)}` : 'function'}(${JSON.stringify(args)}).`);

    const key = JSON.stringify(args);
    let result;
    if (cache.has(key)) {
      result = cache.get(key) as Return;
    } else {
      result = context
        ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
        : (target as (...args: Args) => Return)(...args);
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
      cache.set(key, result);
    }

    console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
    return result;
  };
}
