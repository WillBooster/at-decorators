const MAX_CACHE_SIZE = 10;

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
