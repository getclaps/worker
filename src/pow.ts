import { UUID } from "uuid-class";

type AnyBytes =
  | Int8Array 
  | Int16Array 
  | Int32Array 
  | Uint8Array 
  | Uint16Array 
  | Uint32Array 
  | Uint8ClampedArray 
  | Float32Array 
  | Float64Array 
  | DataView 
  | ArrayBuffer;

const BASE_DIFFICULTY = 8;
const BASE_CLAPS = 15;

function concatArrayBuffers(...abs: ArrayBuffer[]) {
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

const sha256 = (data: AnyBytes) => crypto.subtle.digest('SHA-256', data);

const digest = (message: string) => sha256(new TextEncoder().encode(message));

async function makeKey({ url, id, claps, nonce }: {
  url: URL | string,
  id: UUID | string,
  claps: number,
  nonce: number,
}) {
  return concatArrayBuffers(
    await digest(url.toString()),
    new UUID(id.toString()).buffer,
    new Uint32Array([claps]).buffer,
    new Uint32Array([nonce]).buffer,
  );
}

function leadingZeros(ab: ArrayBuffer, n: number) {
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

const calcDifficulty = (claps: number) => BASE_DIFFICULTY + Math.round(Math.log2(BASE_CLAPS + claps));

export async function proofOfClap({ url, claps, id }: {
  url: URL | string,
  id: UUID | string,
  claps: number,
}) {
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

export async function checkProofOfClap({ url, claps, id, nonce }: {
  url: URL | string,
  claps: number,
  id: UUID | string,
  nonce: number,
}) {
  const difficulty = calcDifficulty(claps);
  const hash = await sha256(await makeKey({ url, id, claps, nonce }));
  return leadingZeros(hash, difficulty);
}
