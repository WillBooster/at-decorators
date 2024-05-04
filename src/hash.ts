// cyrb53 (c) 2018 bryc (github.com/bryc). License: Public domain. Attribution appreciated.
// A fast and simple 64-bit (or 53-bit) string hash function with decent collision resistance.
// Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
// See https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript/52171480#52171480
// https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
function cyrb64(str: string, seed = 0): [number, number] {
  let h1 = 0xde_ad_be_ef ^ seed;
  let h2 = 0x41_c6_ce_57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.codePointAt(i) as number;
    h1 = Math.imul(h1 ^ ch, 2_654_435_761);
    h2 = Math.imul(h2 ^ ch, 1_597_334_677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);
  // For a single 53-bit numeric return value we could return
  // 4294967296 * (2097151 & h2) + (h1 >>> 0);
  // but we instead return the full 64-bit value:
  return [h2 >>> 0, h1 >>> 0];
}

// An improved, *insecure* 64-bit hash that's short, fast, and has no dependencies.
// Output is always 14 characters.
// export function cyrb64Hash(str: string, seed = 0): string {
//   const [h2, h1] = cyrb64(str, seed);
//   return h2.toString(36).padStart(7, '0') + h1.toString(36).padStart(7, '0');
// }

export function cyrb64HashWithLength(str: string, seed = 0): string {
  const [h2, h1] = cyrb64(str, seed);
  return str.length.toString(36) + h2.toString(36).padStart(7, '0') + h1.toString(36).padStart(7, '0');
}
