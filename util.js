import { UUID } from "uuid-class";

const BASE_DIFFICULTY = 12;

/**
 * @param  {...ArrayBuffer} abs 
 */
function concatArrayBuffers(...abs) {
  const u8s = abs.map(a => new Uint8Array(a));
  const size = u8s.reduce((size, u8) => size + u8.length, 0);
  const res = new Uint8Array(size);
  let i = 0;
  for (const u8 of u8s) {
    res.set(u8, i);
    i += u8.length;
  }
  return res.buffer;
}

/**
 * @param {Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView | ArrayBuffer} message 
 */
const digestAB = (message) => crypto.subtle.digest('SHA-256', message)

/**
 * @param {string} message 
 */
const digest = (message) => digestAB(new TextEncoder().encode(message));

/**
 * @param {{
 *   url: URL,
 *   id: UUID|string,
 *   tx: number,
 *   nonce: number,
 * }} param0 
 */
async function makeKey({ url, id, tx, nonce }) {
  return concatArrayBuffers(
    await digest(url.href),
    new UUID(id.toString()).buffer,
    new Uint32Array([tx]).buffer,
    new Uint32Array([nonce]).buffer,
  );
}

/**
 * @param {ArrayBuffer} ab 
 * @param {number} n 
 */
function leadingZeros(ab, n) {
  const arr = Array.from(new Uint8Array(ab).subarray(0, Math.ceil(n / 8)))
    .flatMap(x => [
      (x & 0b10000000) >> 7, 
      (x & 0b01000000) >> 6, 
      (x & 0b00100000) >> 5, 
      (x & 0b00010000) >> 4,
      (x & 0b00001000) >> 3, 
      (x & 0b00000100) >> 2, 
      (x & 0b00000010) >> 1,
      (x & 0b00000001)
    ])
    .slice(0, n)
  return arr
    .every(bit => bit === 0);
}

/**
 * @param {number} claps 
 */
const calcDifficulty = claps => BASE_DIFFICULTY + Math.round(Math.log2(claps));

/**
 * @param {{
 *   url: URL,
 *   claps: number,
 *   id: UUID|string,
 *   tx: number,
 * }} param0 
 */
export async function proofOfClap({ url, claps, id, tx }) {
  const difficulty = calcDifficulty(claps);

  let nonce = 0;

  const key = new Uint32Array(await makeKey({ url, id, tx, nonce }));
  let hash = await digestAB(key);

  while (!leadingZeros(hash, difficulty)) {
    nonce++;
    key[key.length - 1] = nonce;
    hash = await digestAB(key);
  }

  return nonce;
}

/**
 * @param {{
 *   url: URL,
 *   claps: number,
 *   id: UUID|string,
 *   tx: number,
 *   nonce: number,
 * }} param0 
 */
export async function checkProofOfClap({ url, claps, id, tx, nonce }) {
  const difficulty = calcDifficulty(claps);
  const hash = await digestAB(await makeKey({ url, id, tx, nonce }));
  return leadingZeros(hash, difficulty);
}
