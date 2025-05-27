/*
 * MIT License
 *
 * Copyright (c) 2022-2024 KnorpelSenf
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** a map with class names as keys and the respective serializers as values */
export type ConstructorMap<C = any> = Map<string, SerializableConstructor<C>>;
/** a serializer for values or buckets */
export type SerializableConstructor<C, V = any> = ValueConstructor<C, V> | BucketContructor<C, V>;
/** common properties of all serializers */
export interface DecomposableConstructor<C, V = any> {
  /** class constructor */
  instance: new () => C;
  /** converts an instance to a value array */
  from(instance: C): V[];
}
/** a serializer for a value that does not contain nested values */
export interface ValueConstructor<C, V = any> extends DecomposableConstructor<C, V> {
  /** creates a class from a value array */
  create(val: V[]): C;
}

export interface BucketContructor<C, V = any> extends DecomposableConstructor<C, V> {
  /** stubs a class instance that can be re-hydrated */
  stub: () => C;
  /** re-hydrates a class instance with its nested values */
  hydrate: (stub: C, val: V[]) => void;
}

/** label for plain JS object types */
export const PLAIN_OBJECT_LABEL = '';
/**
 * Globally available constructor map that holds sensible default serializers
 * for the following values:
 * - Error
 * - Uint8Array
 * - Map
 * - Set
 * - Date
 * - RegExp
 * - URL
 *
 * You can modify this if you want, but remember that it is global state.
 *
 * This map will be used as the default value for all calls to `parse`,
 * `stringify`, `listify`, and `delistify` if you do not specify your own
 * constructor map explictily.
 */
export const GLOBAL_CONSTRUCTOR_MAP: ConstructorMap = globalConstructorMap();

const enc = new TextEncoder();
const dec8 = new TextDecoder('utf8');
/** creates a new global constructor map as found in GLOBAL_CONSTRUCTOR_MAP */
function globalConstructorMap(): ConstructorMap {
  const error: BucketContructor<Error> = {
    instance: Error,
    from: (err) => {
      const res: unknown[] = [err.name, err.message];
      if (err.stack !== undefined) res.push(err.stack);
      if (err.cause !== undefined) {
        if (err.stack === undefined) res.push(undefined);
        res.push(err.cause);
      }
      return res;
    },
    // eslint-disable-next-line unicorn/error-message
    stub: () => new Error(),
    hydrate: (err, [name, message, stack, cause]) => {
      err.name = name as string;
      err.message = message as string;
      if (stack === undefined) delete err.stack;
      else err.stack = stack as string;
      if (cause !== undefined) err.cause = cause;
    },
  };
  const uint8Array: ValueConstructor<Uint8Array, string> = {
    instance: Uint8Array,
    from: (arr) => [btoa(dec8.decode(arr))],
    create: ([data]) => enc.encode(atob(data)),
  };
  const map: BucketContructor<Map<any, any>, Array<[any, any]>> = {
    instance: Map,
    from: (m) => [...m.entries()],
    stub: () => new Map(),
    hydrate: (m, entries) => {
      for (const [k, v] of entries) m.set(k, v);
    },
  };
  const set: BucketContructor<Set<any>, any[]> = {
    instance: Set,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    from: (s) => [...s.values()],
    stub: () => new Set(),
    hydrate: (s, values) => {
      for (const v of values) s.add(v);
    },
  };
  const date: ValueConstructor<Date, string> = {
    instance: Date,
    from: (d) => [d.toJSON()],
    create: ([json]) => new Date(json),
  };
  const regex: ValueConstructor<RegExp, string> = {
    instance: RegExp as unknown as new () => RegExp,
    from: ({ flags, source }) => (flags ? [source, flags] : [source]),
    create: ([source, flags]) => new RegExp(source, flags),
  };
  const url: ValueConstructor<URL, string> = {
    instance: URL as unknown as new () => URL,
    from: (url) => [url.href],
    create: ([href]) => new URL(href),
  };
  return new Map([error, uint8Array, map, set, date, regex, url].map((c) => [c.instance.name, c]));
}
