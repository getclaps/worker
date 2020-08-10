import { UUID } from "uuid-class/mjs";

const BASE_DIFFICULTY = 8;
const BASE_CLAPS = 15;

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
 * @param {Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView | ArrayBuffer} data 
 */
const sha256 = (data) => crypto.subtle.digest('SHA-256', data)

/**
 * @param {string} message 
 */
const digest = (message) => sha256(new TextEncoder().encode(message));

/**
 * @param {{
 *   url: URL,
 *   id: UUID|string,
 *   claps: number,
 *   nonce: number,
 * }} param0 
 */
async function makeKey({ url, id, claps, nonce }) {
  return concatArrayBuffers(
    await digest(url.href),
    new UUID(id.toString()).buffer,
    new Uint32Array([claps]).buffer,
    new Uint32Array([nonce]).buffer,
  );
}

/**
 * @param {ArrayBuffer} ab 
 * @param {number} n 
 */
function leadingZeros(ab, n) {
  const u8 = new Uint8Array(ab);
  const nb = Math.ceil(n / 8);
  for (let i = 0; i < nb; i++) {
    const ni = Math.min(8, n - i * 8);
    for (let j = 0; j < ni; j++) {
      if (((u8[i] >> (7 - j)) & 0b00000001) !== 0) return false;
    }
  }
  return true;
}

/**
 * @param {number} claps 
 */
const calcDifficulty = claps => BASE_DIFFICULTY + Math.round(Math.log2(BASE_CLAPS + claps));

/**
 * @param {{
 *   url: URL,
 *   id: UUID|string,
 *   claps: number,
 * }} param0 
 */
export async function proofOfClap({ url, claps, id }) {
  const difficulty = calcDifficulty(claps);

  let nonce = 0;

  const key = new Uint32Array(await makeKey({ url, id, claps, nonce }));
  let hash = await sha256(key);

  while (!leadingZeros(hash, difficulty)) {
    nonce++;
    key[key.length - 1] = nonce;
    hash = await sha256(key);
  }

  return nonce;
}

/**
 * @param {{
 *   url: URL,
 *   claps: number,
 *   id: UUID|string,
 *   nonce: number,
 * }} param0 
 */
export async function checkProofOfClap({ url, claps, id, nonce }) {
  const difficulty = calcDifficulty(claps);
  const hash = await sha256(await makeKey({ url, id, claps, nonce }));
  return leadingZeros(hash, difficulty);
}
