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
/* eslint-disable unicorn/no-null */

// magic numbers for values
/** internal magic number representing undefined */
export const UNDEFINED_INDEX = -1 as const;
/** internal magic number representing an array hole */
export const ARRAY_HOLE_INDEX = -2 as const;
/** internal magic number representing NaN */
export const NAN_INDEX = -3 as const;
/** internal magic number representing Infinity */
export const POS_INF_INDEX = -4 as const;
/** internal magic number representing -Infinity */
export const NEG_INF_INDEX = -5 as const;

// magic numbers for oson list type labels
/** internal magic number labelling a bigint */
export const BIG_INT_LABEL = -6 as const;

/** union type of all internal magic numbers */
export type OsonMagic =
  | typeof UNDEFINED_INDEX
  | typeof ARRAY_HOLE_INDEX
  | typeof NAN_INDEX
  | typeof POS_INF_INDEX
  | typeof NEG_INF_INDEX;

/** encoded Oson data */
export type Oson = OsonMagic | OsonValue[];
/** value inside encoded Oson data */
export type OsonValue = OsonPrimitive | OsonList;
/** primitive value inside encoded Oson data */
export type OsonPrimitive = string | number | boolean | null;
/** complex value inside encoded Oson data */
export type OsonList = OsonBigInt | OsonArray | OsonObject;
/** bigint encoded as Oson data */
export type OsonBigInt = [typeof BIG_INT_LABEL, string];
/** array encoded as Oson data */
export type OsonArray = number[];
/** object encoded as Oson data */
export type OsonObject = [label: string, ...values: number[]];

import { type ConstructorMap, GLOBAL_CONSTRUCTOR_MAP, PLAIN_OBJECT_LABEL } from './constructors.js';

/**
 * Converts a value to string. This will preserve circular and repeated
 * references as well as undefined, bigint, and all classes instances defined
 * by the constructor map. Array holes are encoded as undefined.
 *
 * @param value The value to convert to string
 * @param constructors The constructor map to use for class instances
 * @returns The string containing the encoded value
 */
export function stringify<C = any>(value?: unknown, constructors: ConstructorMap<C> = GLOBAL_CONSTRUCTOR_MAP): string {
  return JSON.stringify(listify(value, constructors));
}
function toMagicNumber(value: unknown): OsonMagic | null {
  if (value === undefined) return UNDEFINED_INDEX;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return NAN_INDEX;
    if (!Number.isFinite(value)) return value < 0 ? NEG_INF_INDEX : POS_INF_INDEX;
  }
  return null;
}
/**
 * Converts a value to Oson data. Oson data only contains numbers, strings,
 * arrays, and null values, and can therefore be JSON-encoded. This will
 * preserve circular and repeated references as well as undefined, bigint,
 * and all classes instances defined by the constructor map. Array holes are
 * encoded as undefined.
 *
 * @param value The value to convert to Oson data
 * @param constructors The constructor map to use for class instances
 * @returns The Oson data containing the encoded value
 */
export function listify<C = any>(value: unknown, constructors: ConstructorMap<C> = GLOBAL_CONSTRUCTOR_MAP): Oson {
  const num = toMagicNumber(value);
  if (num !== null) return num;

  const list: OsonValue[] = [];
  const index = new Map<unknown, number>();

  add(value);

  return list;

  function add(value: unknown): number {
    const num = toMagicNumber(value);
    if (num !== null) return num;
    let position = index.get(value);
    if (position !== undefined) return position;
    position = list.length;
    switch (typeof value) {
      case 'number':
      case 'string':
      case 'boolean': {
        list[position] = value;
        index.set(value, position);
        break;
      }
      case 'bigint': {
        list[position] = [BIG_INT_LABEL, value.toString(16)];
        index.set(value, position);
        break;
      }
      case 'object': {
        if (value === null) {
          list[position] = value;
          index.set(value, position);
        } else if (Array.isArray(value)) {
          const len = value.length;
          // eslint-disable-next-line unicorn/no-new-array -- `new Array(n)` is much faster than `Array.from({ length: n })`, and all slots are filled below.
          const arr: OsonArray = new Array<number>(len);
          list[position] = arr;
          index.set(value, position);
          for (let i = 0; i < len; i++) {
            arr[i] = add(value[i]);
          }
        } else {
          // check if we have this instance registered
          const constr = value.constructor;
          const inst = typeof constr === 'function' ? constructors.get(constr.name) : undefined;
          if (inst === undefined) {
            // no instance found, fall back to normal object
            // `Object.keys` + delayed property reads differ from `Object.entries` only when a
            // getter/proxy mutates the object during serialization (a key deleted mid-loop
            // serializes as `undefined` instead of disappearing). Such objects have no stable
            // serialization either way, and avoiding the per-object intermediate entry arrays is
            // what makes this path fast for cache-key derivation.
            const keys = Object.keys(value);
            const cnt = keys.length;
            // eslint-disable-next-line unicorn/no-new-array -- `new Array(n)` is much faster than `Array.from({ length: n })`, and all slots are filled below.
            const arr = new Array(cnt + cnt + 1) as OsonObject;
            arr[0] = PLAIN_OBJECT_LABEL;
            list[position] = arr;
            index.set(value, position);
            for (let i = 0; i < cnt; i++) {
              const key = keys[i] as string;
              const ii = i + i;
              arr[ii + 1] = add(key);
              arr[ii + 2] = add((value as Record<string, unknown>)[key]);
            }
          } else {
            const vals = inst.from(value as C);
            const len = vals.length;
            // eslint-disable-next-line unicorn/no-new-array -- `new Array(n)` is much faster than `Array.from({ length: n })`, and all slots are filled below.
            const arr = new Array(len + 1) as OsonObject;
            arr[0] = constr.name;
            list[position] = arr;
            index.set(value, position);
            for (let i = 0; i < len; i++) {
              arr[i + 1] = add(vals[i]);
            }
          }
        }
      }
    }
    return position;
  }
}
