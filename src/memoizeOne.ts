/**
 * A memoization decorator/function that caches the most recent result of a method call to improve performance.
 * This decorator/function can be applied to methods in a class as a decorator and functions without context as a function.
 *
 * @template This The type of the `this` context within the method.
 * @template Args The types of the arguments to the method.
 * @template Return The return type of the method.
 *
 * @param {Function} target The method or function to be memoized.
 * @param {ClassMethodDecoratorContext} [context] The context in which the decorator is being applied. Optional for standard functions.
 *
 * @returns {Function} A new function that wraps the original method or function with caching logic, storing only the most recent result.
 */
export function memoizeOne<This, Args extends unknown[], Return>(
  target: ((this: This, ...args: Args) => Return) | ((...args: Args) => Return),
  context?: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
): (this: This, ...args: Args) => Return {
  let lastCacheKey: string;
  let lastCache: Return;

  return function (this: This, ...args: Args): Return {
    console.log(`Entering method ${context ? String(context.name) : ''}(${JSON.stringify(args)}).`);

    const key = JSON.stringify(args);
    if (lastCacheKey !== key) {
      lastCacheKey = key;
      lastCache = context ? target.call(this, ...args) : (target as (...args: Args) => Return)(...args);
    }

    console.log(`Exiting method ${context ? String(context.name) : ''}${String(context?.name)}.`);
    return lastCache;
  };
}
