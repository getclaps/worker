const byteToHex = (byte: number) => byte.toString(16).padStart(2, '0');
const hexToByte = (hex: string) => parseInt(hex, 16);
const hexStringToArrayBuffer = (hex: string) => new Uint8Array(hex.match(/[0-9A-Fa-f]{1,2}/g).map(hexToByte)).buffer;
const arrayBufferToHexString = (arrayBuffer: ArrayBuffer) => Array.from(new Uint8Array(arrayBuffer), byte => byteToHex(byte)).join('');

function compareArrayBuffers(ab1: ArrayBuffer, ab2: ArrayBuffer) {
  if (ab1.byteLength != ab2.byteLength) return false;
  const dv1 = new Uint8Array(ab1);
  const dv2 = new Uint8Array(ab2);
  for (let i = 0; i != ab1.byteLength; i++) if (dv1[i] !== dv2[i]) return false;
  return true;
}

function compareArrayBufferTo(expected: ArrayBuffer) {
  return (candidate: ArrayBuffer) => {
    return compareArrayBuffers(expected, candidate);
  }
}

async function computeSignature(signedPayload: string, secret: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "HMAC" }, cryptoKey, new TextEncoder().encode(signedPayload));
  return signature;
}

const DEFAULT_TOLERANCE = 300; // 5 minutes

export function constructEvent(payload: string, header: string, secret: string, tolerance?: number) {
  verifyHeader(
    payload,
    header,
    secret,
    tolerance || DEFAULT_TOLERANCE
  );

  const jsonPayload = JSON.parse(payload);
  return jsonPayload;
}

/**
 * Generates a header to be used for webhook mocking
 */
export async function generateTestHeaderString(opts: {
  timestamp: number,
  payload: string,
  secret: string,
  scheme: string,
  signature: string,
}) {
  if (!opts) {
    throw new Error('Options are required');
  }

  opts.timestamp =
    Math.floor(opts.timestamp) || Math.floor(Date.now() / 1000);
  opts.scheme = opts.scheme || EXPECTED_SCHEME;

  opts.signature =
    opts.signature ||
    arrayBufferToHexString(await computeSignature(
      `${opts.timestamp}.${opts.payload}`,
      opts.secret
    ));

  const generatedHeader = [
    't=' + opts.timestamp,
    opts.scheme + '=' + opts.signature,
  ].join(',');

  return generatedHeader;
}

const EXPECTED_SCHEME = 'v1';

async function verifyHeader(payload: string, header: string, secret: string, tolerance: number) {
  const details = parseHeader(header, EXPECTED_SCHEME);

  if (!details || details.timestamp === -1) {
    throw new Error('Unable to extract timestamp and signatures from header')
  }

  if (!details.signatures.length) {
    throw new Error('No signatures found with expected scheme');
  }

  const expectedSignature = await computeSignature(
    `${details.timestamp}.${payload}`,
    secret
  );

  const signatureFound = !!details.signatures
    .map(hexStringToArrayBuffer)
    .filter(compareArrayBufferTo(expectedSignature))
    .length;

  if (!signatureFound) {
    throw new Error('No signatures found matching the expected signature for payload.' +
        ' Are you passing the raw request body you received from Stripe?' +
        ' https://github.com/stripe/stripe-node#webhook-signing');
  }

  const timestampAge = Math.floor(Date.now() / 1000) - Number(details.timestamp);

  if (tolerance > 0 && timestampAge > tolerance) {
    throw new Error('Timestamp outside the tolerance zone');
  }

  return true;
}

function parseHeader(header: string, scheme: string): { timestamp: number, signatures: string[] } {
  if (typeof header !== 'string') {
    return null;
  }

  return header.split(',').reduce(
    (accum, item) => {
      const kv = item.split('=');

      if (kv[0] === 't') {
        accum.timestamp = Number(kv[1]);
      }

      if (kv[0] === scheme) {
        accum.signatures.push(kv[1]);
      }

      return accum;
    },
    {
      timestamp: -1,
      signatures: [],
    }
  );
}
