const MAX_CACHE_SIZE = 10;

/**
 * A memoization decorator that caches the results of method calls to improve performance.
 * This decorator can be applied to methods in a class.
 *
 * @template This The type of the `this` context within the method.
 * @template Args The types of the arguments to the method.
 * @template Return The return type of the method.
 *
 * @param {Function} target The method to be memoized.
 * @param {ClassMethodDecoratorContext} context The context in which the decorator is being applied.
 *
 * @returns {Function} A new function that wraps the original method with caching logic.
 */
export function memoize<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
): (this: This, ...args: Args) => Return {
  const cache = new Map<string, Return>();

  return function (this: This, ...args: Args): Return {
    console.log(`Entering method '${String(context.name)}(${JSON.stringify(args)})'.`);

    const key = JSON.stringify(args);
    let result;
    if (cache.has(key)) {
      result = cache.get(key) as Return;
    } else {
      result = target.call(this, ...args);
      cache.set(key, result);
      if (cache.size > MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
    }

    console.log(`Exiting method '${String(context.name)}'.`);
    return result;
  };
}

/**
 * A memoization function for standalone functions that caches the results of function calls to improve performance.
 *
 * @template Args The types of the arguments to the function.
 * @template Return The return type of the function.
 *
 * @param {Function} func The function to be memoized.
 *
 * @returns {Function} A new function that wraps the original function with caching logic.
 */
export function memoizeFunction<Args extends unknown[], Return>(
  func: (...args: Args) => Return
): (...args: Args) => Return {
  const cache = new Map<string, Return>();

  return function (...args: Args): Return {
    console.log(`Entering method with (${JSON.stringify(args)}).`);

    const key = JSON.stringify(args);
    let result;
    if (cache.has(key)) {
      result = cache.get(key) as Return;
    } else {
      result = func(...args);
      cache.set(key, result);
      if (cache.size > MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
    }

    console.log(`Exiting method.`);
    return result;
  };
}
