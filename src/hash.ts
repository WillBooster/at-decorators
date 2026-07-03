// Copyright 2015-2023 Chen, Yi-Cyuan
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/**
 * A SHA3-512 implementation specialized and optimized from
 * [js-sha3]{@link https://github.com/emn178/js-sha3} (version 0.9.3).
 *
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2023
 * @license MIT
 */

// SHA3-512 parameters: rate = 576 bits = 72 bytes = 18 32-bit words.
const BYTE_COUNT = 72;
const BLOCK_COUNT = 18;
// 512-bit output = 16 32-bit words.
const OUTPUT_BLOCKS = 16;

const HEX_PAIRS: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

// Keccak round constants interleaved as [low, high] 32-bit words. Int32Array stores the same bit
// patterns as the original unsigned constants, and XOR is bit-pattern based.
// eslint-disable-next-line unicorn/prefer-spread
const RC = new Int32Array([
  1, 0, 32_898, 0, 32_906, 2_147_483_648, 2_147_516_416, 2_147_483_648, 32_907, 0, 2_147_483_649, 0, 2_147_516_545,
  2_147_483_648, 32_777, 2_147_483_648, 138, 0, 136, 0, 2_147_516_425, 0, 2_147_483_658, 0, 2_147_516_555, 0, 139,
  2_147_483_648, 32_905, 2_147_483_648, 32_771, 2_147_483_648, 32_770, 2_147_483_648, 128, 2_147_483_648, 32_778, 0,
  2_147_483_658, 2_147_483_648, 2_147_516_545, 2_147_483_648, 32_896, 2_147_483_648, 2_147_483_649, 0, 2_147_516_424,
  2_147_483_648,
]);

// Reused across calls to avoid per-call allocations. Safe because sha3_512 is fully synchronous.
// `sharedState` holds the 1600-bit Keccak state as 50 32-bit words; `sharedBlocks` holds the final
// (padded) rate block. `byteBuffer`/`wordBuffer` are two views of one growable buffer holding the
// UTF-8 encoded message.
const sharedState = new Int32Array(50);
const sharedBlocks = new Int32Array(BLOCK_COUNT);
const textEncoder = new TextEncoder();
let byteBuffer = new Uint8Array(4096);
let wordBuffer = new Uint32Array(byteBuffer.buffer);
// Buffers grown beyond this cap are used only for the current call and left to the GC, so one
// huge input doesn't pin a large ArrayBuffer for the process lifetime.
const MAX_RETAINED_BUFFER_LENGTH = 1 << 20;

// Absorbing the UTF-8 bytes as whole 32-bit words via `wordBuffer` assumes little-endian layout,
// which holds on all mainstream platforms; fall back to byte-wise composition otherwise.
const IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/**
 * Computes the SHA3-512 hash of the given string (encoded as UTF-8) and returns it as a hex string.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function sha3_512(message: string): string {
  // A UTF-16 code unit encodes to at most 3 UTF-8 bytes.
  const maxByteLength = message.length * 3;
  let bytes = byteBuffer;
  let words = wordBuffer;
  if (bytes.length < maxByteLength) {
    let newLength = bytes.length * 2;
    while (newLength < maxByteLength) {
      newLength *= 2;
    }
    bytes = new Uint8Array(newLength);
    words = new Uint32Array(bytes.buffer);
    if (newLength <= MAX_RETAINED_BUFFER_LENGTH) {
      byteBuffer = bytes;
      wordBuffer = words;
    }
  }
  const byteLength = textEncoder.encodeInto(message, bytes).written;

  const s = sharedState;
  s.fill(0);

  // Absorb all full rate blocks directly from the encoded bytes.
  let byteIndex = 0;
  if (IS_LITTLE_ENDIAN) {
    let wordIndex = 0;
    while (byteLength - byteIndex >= BYTE_COUNT) {
      for (let w = 0; w < BLOCK_COUNT; w++) {
        s[w] = (s[w] as number) ^ (words[wordIndex + w] as number);
      }
      f(s);
      wordIndex += BLOCK_COUNT;
      byteIndex += BYTE_COUNT;
    }
  } else {
    while (byteLength - byteIndex >= BYTE_COUNT) {
      for (let w = 0; w < BLOCK_COUNT; w++) {
        const b = byteIndex + (w << 2);
        s[w] =
          (s[w] as number) ^
          ((bytes[b] as number) |
            ((bytes[b + 1] as number) << 8) |
            ((bytes[b + 2] as number) << 16) |
            ((bytes[b + 3] as number) << 24));
      }
      f(s);
      byteIndex += BYTE_COUNT;
    }
  }

  // Absorb the last (possibly empty) partial block with SHA3 padding.
  const blocks = sharedBlocks;
  blocks.fill(0);
  for (let b = byteIndex; b < byteLength; b++) {
    const i = b - byteIndex;
    blocks[i >> 2] = (blocks[i >> 2] as number) | ((bytes[b] as number) << ((i & 3) << 3));
  }
  const remainder = byteLength - byteIndex;
  blocks[remainder >> 2] = (blocks[remainder >> 2] as number) | (0x06 << ((remainder & 3) << 3));
  blocks[BLOCK_COUNT - 1] = (blocks[BLOCK_COUNT - 1] as number) | 0x80_00_00_00;
  for (let w = 0; w < BLOCK_COUNT; w++) {
    s[w] = (s[w] as number) ^ (blocks[w] as number);
  }
  f(s);

  let hex = '';
  for (let w = 0; w < OUTPUT_BLOCKS; w += 4) {
    const w0 = s[w] as number;
    const w1 = s[w + 1] as number;
    const w2 = s[w + 2] as number;
    const w3 = s[w + 3] as number;
    hex +=
      (HEX_PAIRS[w0 & 0xff] as string) +
      HEX_PAIRS[(w0 >> 8) & 0xff] +
      HEX_PAIRS[(w0 >> 16) & 0xff] +
      HEX_PAIRS[w0 >>> 24] +
      HEX_PAIRS[w1 & 0xff] +
      HEX_PAIRS[(w1 >> 8) & 0xff] +
      HEX_PAIRS[(w1 >> 16) & 0xff] +
      HEX_PAIRS[w1 >>> 24] +
      HEX_PAIRS[w2 & 0xff] +
      HEX_PAIRS[(w2 >> 8) & 0xff] +
      HEX_PAIRS[(w2 >> 16) & 0xff] +
      HEX_PAIRS[w2 >>> 24] +
      HEX_PAIRS[w3 & 0xff] +
      HEX_PAIRS[(w3 >> 8) & 0xff] +
      HEX_PAIRS[(w3 >> 16) & 0xff] +
      HEX_PAIRS[w3 >>> 24];
  }
  return hex;
}

// eslint-disable-next-line max-lines-per-function
function f(s: Int32Array): void {
  let h: number;
  let l: number;
  let n: number;
  let c0: number;
  let c1: number;
  let c2: number;
  let c3: number;
  let c4: number;
  let c5: number;
  let c6: number;
  let c7: number;
  let c8: number;
  let c9: number;
  let b0: number;
  let b1: number;
  let b2: number;
  let b3: number;
  let b4: number;
  let b5: number;
  let b6: number;
  let b7: number;
  let b8: number;
  let b9: number;
  let b10: number;
  let b11: number;
  let b12: number;
  let b13: number;
  let b14: number;
  let b15: number;
  let b16: number;
  let b17: number;
  let b18: number;
  let b19: number;
  let b20: number;
  let b21: number;
  let b22: number;
  let b23: number;
  let b24: number;
  let b25: number;
  let b26: number;
  let b27: number;
  let b28: number;
  let b29: number;
  let b30: number;
  let b31: number;
  let b32: number;
  let b33: number;
  let b34: number;
  let b35: number;
  let b36: number;
  let b37: number;
  let b38: number;
  let b39: number;
  let b40: number;
  let b41: number;
  let b42: number;
  let b43: number;
  let b44: number;
  let b45: number;
  let b46: number;
  let b47: number;
  let b48: number;
  let b49: number;
  let s0 = s[0] as number;
  let s1 = s[1] as number;
  let s2 = s[2] as number;
  let s3 = s[3] as number;
  let s4 = s[4] as number;
  let s5 = s[5] as number;
  let s6 = s[6] as number;
  let s7 = s[7] as number;
  let s8 = s[8] as number;
  let s9 = s[9] as number;
  let s10 = s[10] as number;
  let s11 = s[11] as number;
  let s12 = s[12] as number;
  let s13 = s[13] as number;
  let s14 = s[14] as number;
  let s15 = s[15] as number;
  let s16 = s[16] as number;
  let s17 = s[17] as number;
  let s18 = s[18] as number;
  let s19 = s[19] as number;
  let s20 = s[20] as number;
  let s21 = s[21] as number;
  let s22 = s[22] as number;
  let s23 = s[23] as number;
  let s24 = s[24] as number;
  let s25 = s[25] as number;
  let s26 = s[26] as number;
  let s27 = s[27] as number;
  let s28 = s[28] as number;
  let s29 = s[29] as number;
  let s30 = s[30] as number;
  let s31 = s[31] as number;
  let s32 = s[32] as number;
  let s33 = s[33] as number;
  let s34 = s[34] as number;
  let s35 = s[35] as number;
  let s36 = s[36] as number;
  let s37 = s[37] as number;
  let s38 = s[38] as number;
  let s39 = s[39] as number;
  let s40 = s[40] as number;
  let s41 = s[41] as number;
  let s42 = s[42] as number;
  let s43 = s[43] as number;
  let s44 = s[44] as number;
  let s45 = s[45] as number;
  let s46 = s[46] as number;
  let s47 = s[47] as number;
  let s48 = s[48] as number;
  let s49 = s[49] as number;
  for (n = 0; n < 48; n += 2) {
    c0 = s0 ^ s10 ^ s20 ^ s30 ^ s40;
    c1 = s1 ^ s11 ^ s21 ^ s31 ^ s41;
    c2 = s2 ^ s12 ^ s22 ^ s32 ^ s42;
    c3 = s3 ^ s13 ^ s23 ^ s33 ^ s43;
    c4 = s4 ^ s14 ^ s24 ^ s34 ^ s44;
    c5 = s5 ^ s15 ^ s25 ^ s35 ^ s45;
    c6 = s6 ^ s16 ^ s26 ^ s36 ^ s46;
    c7 = s7 ^ s17 ^ s27 ^ s37 ^ s47;
    c8 = s8 ^ s18 ^ s28 ^ s38 ^ s48;
    c9 = s9 ^ s19 ^ s29 ^ s39 ^ s49;

    h = c8 ^ ((c2 << 1) | (c3 >>> 31));
    l = c9 ^ ((c3 << 1) | (c2 >>> 31));
    s0 ^= h;
    s1 ^= l;
    s10 ^= h;
    s11 ^= l;
    s20 ^= h;
    s21 ^= l;
    s30 ^= h;
    s31 ^= l;
    s40 ^= h;
    s41 ^= l;
    h = c0 ^ ((c4 << 1) | (c5 >>> 31));
    l = c1 ^ ((c5 << 1) | (c4 >>> 31));
    s2 ^= h;
    s3 ^= l;
    s12 ^= h;
    s13 ^= l;
    s22 ^= h;
    s23 ^= l;
    s32 ^= h;
    s33 ^= l;
    s42 ^= h;
    s43 ^= l;
    h = c2 ^ ((c6 << 1) | (c7 >>> 31));
    l = c3 ^ ((c7 << 1) | (c6 >>> 31));
    s4 ^= h;
    s5 ^= l;
    s14 ^= h;
    s15 ^= l;
    s24 ^= h;
    s25 ^= l;
    s34 ^= h;
    s35 ^= l;
    s44 ^= h;
    s45 ^= l;
    h = c4 ^ ((c8 << 1) | (c9 >>> 31));
    l = c5 ^ ((c9 << 1) | (c8 >>> 31));
    s6 ^= h;
    s7 ^= l;
    s16 ^= h;
    s17 ^= l;
    s26 ^= h;
    s27 ^= l;
    s36 ^= h;
    s37 ^= l;
    s46 ^= h;
    s47 ^= l;
    h = c6 ^ ((c0 << 1) | (c1 >>> 31));
    l = c7 ^ ((c1 << 1) | (c0 >>> 31));
    s8 ^= h;
    s9 ^= l;
    s18 ^= h;
    s19 ^= l;
    s28 ^= h;
    s29 ^= l;
    s38 ^= h;
    s39 ^= l;
    s48 ^= h;
    s49 ^= l;

    b0 = s0;
    b1 = s1;
    b32 = (s11 << 4) | (s10 >>> 28);
    b33 = (s10 << 4) | (s11 >>> 28);
    b14 = (s20 << 3) | (s21 >>> 29);
    b15 = (s21 << 3) | (s20 >>> 29);
    b46 = (s31 << 9) | (s30 >>> 23);
    b47 = (s30 << 9) | (s31 >>> 23);
    b28 = (s40 << 18) | (s41 >>> 14);
    b29 = (s41 << 18) | (s40 >>> 14);
    b20 = (s2 << 1) | (s3 >>> 31);
    b21 = (s3 << 1) | (s2 >>> 31);
    b2 = (s13 << 12) | (s12 >>> 20);
    b3 = (s12 << 12) | (s13 >>> 20);
    b34 = (s22 << 10) | (s23 >>> 22);
    b35 = (s23 << 10) | (s22 >>> 22);
    b16 = (s33 << 13) | (s32 >>> 19);
    b17 = (s32 << 13) | (s33 >>> 19);
    b48 = (s42 << 2) | (s43 >>> 30);
    b49 = (s43 << 2) | (s42 >>> 30);
    b40 = (s5 << 30) | (s4 >>> 2);
    b41 = (s4 << 30) | (s5 >>> 2);
    b22 = (s14 << 6) | (s15 >>> 26);
    b23 = (s15 << 6) | (s14 >>> 26);
    b4 = (s25 << 11) | (s24 >>> 21);
    b5 = (s24 << 11) | (s25 >>> 21);
    b36 = (s34 << 15) | (s35 >>> 17);
    b37 = (s35 << 15) | (s34 >>> 17);
    b18 = (s45 << 29) | (s44 >>> 3);
    b19 = (s44 << 29) | (s45 >>> 3);
    b10 = (s6 << 28) | (s7 >>> 4);
    b11 = (s7 << 28) | (s6 >>> 4);
    b42 = (s17 << 23) | (s16 >>> 9);
    b43 = (s16 << 23) | (s17 >>> 9);
    b24 = (s26 << 25) | (s27 >>> 7);
    b25 = (s27 << 25) | (s26 >>> 7);
    b6 = (s36 << 21) | (s37 >>> 11);
    b7 = (s37 << 21) | (s36 >>> 11);
    b38 = (s47 << 24) | (s46 >>> 8);
    b39 = (s46 << 24) | (s47 >>> 8);
    b30 = (s8 << 27) | (s9 >>> 5);
    b31 = (s9 << 27) | (s8 >>> 5);
    b12 = (s18 << 20) | (s19 >>> 12);
    b13 = (s19 << 20) | (s18 >>> 12);
    b44 = (s29 << 7) | (s28 >>> 25);
    b45 = (s28 << 7) | (s29 >>> 25);
    b26 = (s38 << 8) | (s39 >>> 24);
    b27 = (s39 << 8) | (s38 >>> 24);
    b8 = (s48 << 14) | (s49 >>> 18);
    b9 = (s49 << 14) | (s48 >>> 18);

    s0 = b0 ^ (~b2 & b4);
    s1 = b1 ^ (~b3 & b5);
    s10 = b10 ^ (~b12 & b14);
    s11 = b11 ^ (~b13 & b15);
    s20 = b20 ^ (~b22 & b24);
    s21 = b21 ^ (~b23 & b25);
    s30 = b30 ^ (~b32 & b34);
    s31 = b31 ^ (~b33 & b35);
    s40 = b40 ^ (~b42 & b44);
    s41 = b41 ^ (~b43 & b45);
    s2 = b2 ^ (~b4 & b6);
    s3 = b3 ^ (~b5 & b7);
    s12 = b12 ^ (~b14 & b16);
    s13 = b13 ^ (~b15 & b17);
    s22 = b22 ^ (~b24 & b26);
    s23 = b23 ^ (~b25 & b27);
    s32 = b32 ^ (~b34 & b36);
    s33 = b33 ^ (~b35 & b37);
    s42 = b42 ^ (~b44 & b46);
    s43 = b43 ^ (~b45 & b47);
    s4 = b4 ^ (~b6 & b8);
    s5 = b5 ^ (~b7 & b9);
    s14 = b14 ^ (~b16 & b18);
    s15 = b15 ^ (~b17 & b19);
    s24 = b24 ^ (~b26 & b28);
    s25 = b25 ^ (~b27 & b29);
    s34 = b34 ^ (~b36 & b38);
    s35 = b35 ^ (~b37 & b39);
    s44 = b44 ^ (~b46 & b48);
    s45 = b45 ^ (~b47 & b49);
    s6 = b6 ^ (~b8 & b0);
    s7 = b7 ^ (~b9 & b1);
    s16 = b16 ^ (~b18 & b10);
    s17 = b17 ^ (~b19 & b11);
    s26 = b26 ^ (~b28 & b20);
    s27 = b27 ^ (~b29 & b21);
    s36 = b36 ^ (~b38 & b30);
    s37 = b37 ^ (~b39 & b31);
    s46 = b46 ^ (~b48 & b40);
    s47 = b47 ^ (~b49 & b41);
    s8 = b8 ^ (~b0 & b2);
    s9 = b9 ^ (~b1 & b3);
    s18 = b18 ^ (~b10 & b12);
    s19 = b19 ^ (~b11 & b13);
    s28 = b28 ^ (~b20 & b22);
    s29 = b29 ^ (~b21 & b23);
    s38 = b38 ^ (~b30 & b32);
    s39 = b39 ^ (~b31 & b33);
    s48 = b48 ^ (~b40 & b42);
    s49 = b49 ^ (~b41 & b43);

    s0 ^= RC[n] as number;
    s1 ^= RC[n + 1] as number;
  }
  s[0] = s0;
  s[1] = s1;
  s[2] = s2;
  s[3] = s3;
  s[4] = s4;
  s[5] = s5;
  s[6] = s6;
  s[7] = s7;
  s[8] = s8;
  s[9] = s9;
  s[10] = s10;
  s[11] = s11;
  s[12] = s12;
  s[13] = s13;
  s[14] = s14;
  s[15] = s15;
  s[16] = s16;
  s[17] = s17;
  s[18] = s18;
  s[19] = s19;
  s[20] = s20;
  s[21] = s21;
  s[22] = s22;
  s[23] = s23;
  s[24] = s24;
  s[25] = s25;
  s[26] = s26;
  s[27] = s27;
  s[28] = s28;
  s[29] = s29;
  s[30] = s30;
  s[31] = s31;
  s[32] = s32;
  s[33] = s33;
  s[34] = s34;
  s[35] = s35;
  s[36] = s36;
  s[37] = s37;
  s[38] = s38;
  s[39] = s39;
  s[40] = s40;
  s[41] = s41;
  s[42] = s42;
  s[43] = s43;
  s[44] = s44;
  s[45] = s45;
  s[46] = s46;
  s[47] = s47;
  s[48] = s48;
  s[49] = s49;
}
