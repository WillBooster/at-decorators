import { sha3_512 } from './hash.js';

/**
 * Calculates a hash value for the given context and arguments using SHA3-512.
 * Used for memoization cache keys.
 *
 * @param self - The context ('this' value) to include in the hash calculation
 * @param args - The arguments to include in the hash calculation
 * @returns A SHA3-512 hash of the stringified context and arguments
 */
export function calcHashWithContext(self: unknown, args: unknown[]): string {
  return sha3_512(JSON.stringify([self, args]));
}

/**
 * Returns an empty string as a hash value.
 * Used when no hash calculation is needed for memoization.
 *
 * @returns An empty string
 */
export function calcEmptyHash(): string {
  return '';
}
