import { UUID } from "uuid-class";

const BASE_DIFFICULTY = 12;

export const SEPARATOR = ':';

/**
 * @param  {...ArrayBuffer} as 
 */
function concatArrayBuffers(...as) {
  const a8s = as.map(a => new Uint8Array(a));
  const size8 = a8s.reduce((size, a8) => size + a8.length, 0);
  const c8 = new Uint8Array(size8);
  let i = 0;
  for (const a8 of a8s) {
    c8.set(a8, i);
    i += a8.length;
  }
  return c8.buffer;
}

/**
 * @param {string| Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView | ArrayBuffer} message 
 */
const digest = async (message) => crypto.subtle.digest('SHA-256', typeof message === 'string' 
  ? new TextEncoder().encode(message)
  : message);

/**
 * @param {{
 *   url: URL|string,
 *   id?: UUID|string,
 *   tx?: number|string,
 *   nonce?: number|string,
 * }} param0 
 */
export async function makeKey({ url, id, tx, nonce }) {
  const keyUrl = new URL(url.toString());
  keyUrl.search = '';

  // return [
  //   b64e.encode(await digest(keyUrl.href)), 
  //   ...id != null ? [b64e.encode(new UUID(id.toString()).buffer)] : [], 
  //   ...tx != null ? [tx] : [], 
  //   ...nonce != null ? [nonce] : []
  // ].join(SEPARATOR);

  // 256/8 + 128/8 + 32/8
  return concatArrayBuffers(
    await digest(keyUrl.href), // 256 / 8
    ...id != null ? [new UUID(id.toString()).buffer] : [], // 128 / 8
    ...tx != null ? [new Uint32Array([Number(tx)]).buffer] : [], // 32 / 8
    ...nonce != null ? [new Uint32Array([Number(nonce)]).buffer] : [],
  );
}

/**
 * @param {ArrayBuffer} hash 
 * @param {number} difficulty 
 */
function checkZeros(hash, difficulty) {
  const arr = Array.from(new Uint8Array(hash).subarray(0, Math.ceil(difficulty / 8)))
    .flatMap(x => [
      (x & 0b10000000) >> 7, 
      (x & 0b01000000) >> 6, 
      (x & 0b00100000) >> 5, 
      (x & 0b00010000) >> 4,
      (x & 0b00001000) >> 3, 
      (x & 0b00000100) >> 2, 
      (x & 0b00000010) >> 1,
      (x & 0b00000001)])
    .slice(0, difficulty)
  return arr
    .every(bit => bit === 0);
}

/**
 * @param {number} claps 
 */
export const calcDifficulty = claps => BASE_DIFFICULTY + Math.round(Math.log2(claps));

/**
 * @param {{
 *   url: URL|string,
 *   id: UUID|string,
 *   tx: number|string,
 * }} param0 
 * @param {number} difficulty
 */
export async function proofOfClap({ url, id, tx }, difficulty) {
  let nonce = 0;

  const key = new Uint32Array(await makeKey({ url, id, tx, nonce }));
  let hash = await digest(key);

  while (!checkZeros(hash, difficulty)) {
    nonce++;
    key[key.length - 1] = nonce;
    hash = await digest(key);
    // await new Promise(r => setTimeout(r, 1000));
  }

  return nonce;
}

/**
 * @param {{
 *   url: URL|string,
 *   id: UUID|string,
 *   tx: number|string,
 *   nonce: number|string,
 * }} param0 
 * @param {number} difficulty
 */
export async function checkProofOfClap({ url, id, tx, nonce }, difficulty) {
  const hash = await digest(await makeKey({ url, id, tx, nonce }));
  return checkZeros(hash, difficulty);
}
