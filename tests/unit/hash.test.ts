import { sha3_512 } from '../../src/hash.js';

test('sha3_512', () => {
  expect(sha3_512('')).toBe(
    'a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26'
  );

  expect(sha3_512('The quick brown fox jumps over the lazy dog')).toBe(
    '01dedd5de4ef14642445ba5f5b97c15e47b9ad931326e4b0727cd94cefc44fff23f07bf543139939b49128caf436dc1bdee54fcb24023a08d9403f9b4bf0d450'
  );

  expect(sha3_512('The quick brown fox jumps over the lazy dog.')).toBe(
    '18f4f4bd419603f95538837003d9d254c26c23765565162247483f65c50303597bc9ce4d289f21d1c2f1f458828e33dc442100331b35e7eb031b5d38ba6460f8'
  );
});
