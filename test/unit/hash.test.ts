import { createHash } from 'node:crypto';

import { sha3_512, sha3_512InJs } from '../../src/hash.js';

test.each([sha3_512, sha3_512InJs])('%o', (hash) => {
  expect(hash('')).toBe(
    'a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26'
  );

  expect(hash('The quick brown fox jumps over the lazy dog')).toBe(
    '01dedd5de4ef14642445ba5f5b97c15e47b9ad931326e4b0727cd94cefc44fff23f07bf543139939b49128caf436dc1bdee54fcb24023a08d9403f9b4bf0d450'
  );

  expect(hash('The quick brown fox jumps over the lazy dog.')).toBe(
    '18f4f4bd419603f95538837003d9d254c26c23765565162247483f65c50303597bc9ce4d289f21d1c2f1f458828e33dc442100331b35e7eb031b5d38ba6460f8'
  );
});

test('sha3_512InJs matches node:crypto across block boundaries and non-ASCII input', () => {
  for (let length = 0; length < 300; length++) {
    const message = Array.from({ length }, (_, i) => String.fromCodePoint(0x20 + ((i * 7919 + length) % 0x30_00))).join(
      ''
    );
    expect(sha3_512InJs(message)).toBe(createHash('sha3-512').update(message).digest('hex'));
  }
  const large = 'あ🎉x'.repeat(100_000);
  expect(sha3_512InJs(large)).toBe(createHash('sha3-512').update(large).digest('hex'));
});

test.each([
  ['lacks SHA3-512', { getHashes: () => ['sha256'], createHash: throwUnsupportedDigest }],
  ['lacks getHashes', { createHash: throwUnsupportedDigest }],
])('sha3_512 falls back to JavaScript where node:crypto %s', async (_, crypto) => {
  vi.resetModules();
  vi.stubGlobal('process', { getBuiltinModule: () => crypto });
  try {
    const { sha3_512: hash } = await import('../../src/hash.js');
    expect(hash('The quick brown fox jumps over the lazy dog')).toBe(
      '01dedd5de4ef14642445ba5f5b97c15e47b9ad931326e4b0727cd94cefc44fff23f07bf543139939b49128caf436dc1bdee54fcb24023a08d9403f9b4bf0d450'
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

function throwUnsupportedDigest(): never {
  throw new Error('Digest method not supported');
}
