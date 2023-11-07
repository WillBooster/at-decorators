/**
 * A memoization decorator/function that caches the results of the latest method/getter/function call to improve performance.
 * This decorator/function can be applied to methods and getters in a class as a decorator, and functions without context as a function.
 * The cache only stores the latest value. When a new value is computed, the previous cached value is replaced.
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
export function memoizeOne<This, Args extends unknown[], Return>(
  target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return) | keyof This,
  context?:
    | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
    | ClassGetterDecoratorContext<This, Return>
): (this: This, ...args: Args) => Return {
  let lastThis: This;
  let lastCache: Return;

  if (context?.kind === 'getter') {
    return function (this: This): Return {
      console.log(`Entering getter ${String(context.name)}.`);

      if (lastThis !== this) {
        // eslint-disable-next-line
        lastThis = this;
        lastCache = (target as (this: This) => Return).call(this);
      }

      console.log(`Exiting getter ${String(context.name)}.`);
      return lastCache;
    };
  }

  let lastCacheKey: string;

  return function (this: This, ...args: Args): Return {
    console.log(`Entering ${context ? `method ${String(context.name)}` : 'function'}(${JSON.stringify(args)}).`);

    const key = JSON.stringify(args);
    if (lastThis !== this || lastCacheKey !== key) {
      // eslint-disable-next-line
      lastThis = this;
      lastCacheKey = key;
      lastCache = context
        ? (target as (this: This, ...args: Args) => Return).call(this, ...args)
        : (target as (...args: Args) => Return)(...args);
    }

    console.log(`Exiting ${context ? `method ${String(context.name)}` : 'function'}.`);
    return lastCache;
  };
}
