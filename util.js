import { UUID } from "uuid-class";
import { Base64Encoder } from 'base64-encoding';

export const SEPARATOR = ':';

const b64e = new Base64Encoder();

/**
 * @param {string} message 
 */
const digest = async (message) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));

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

  const urlB64 = b64e.encode(await digest(keyUrl.href));
  const idB64 = id != null ? [b64e.encode(new UUID(id.toString()).buffer)] : [];
  const txArr = tx ? [tx] : []
  const nonceArr = nonce ? [nonce] : []

  return [urlB64, ...idB64, ...txArr, ...nonceArr].join(SEPARATOR);
}

/**
 * @param {Uint8Array} hash 
 * @param {number} difficulty 
 */
function youKnowTheThing(hash, difficulty) {
  const arr = Array.from(hash.subarray(0, Math.ceil(difficulty / 8)))
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
 * @param {{
 *   url: URL|string,
 *   id: UUID|string,
 *   tx: number|string,
 * }} param0 
 * @param {number} difficulty
 */
export async function proofOfClap({ url, id, tx }, difficulty) {
  let nonce = 0;
  let hash = new Uint8Array(await digest(await makeKey({ url, id, tx, nonce })));

  while (!youKnowTheThing(hash, difficulty)) {
    nonce++;
    hash = new Uint8Array(await digest(await makeKey({ url, id, tx, nonce })));
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
  const hash = new Uint8Array(await digest(await makeKey({ url, id, tx, nonce })));
  return youKnowTheThing(hash, difficulty);
}
