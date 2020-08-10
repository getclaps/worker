const byteToHex = byte => byte.toString(16).padStart(2, '0');
const hexToByte = hex => parseInt(hex, 16);

/**
 * @param {string} hex 
 */
const hexStringToArrayBuffer = (hex) => new Uint8Array(hex.match(/[0-9A-Fa-f]{1,2}/g).map(hexToByte)).buffer;

/**
 * @param {ArrayBuffer} arrayBuffer 
 */
const arrayBufferToHexString = (arrayBuffer) => Array.from(new Uint8Array(arrayBuffer), byte => byteToHex(byte)).join('');

/** 
 * @param {ArrayBuffer} ab1
 * @param {ArrayBuffer} ab2 
 */ 
function compareArrayBuffers(ab1, ab2) {
  if (ab1.byteLength != ab2.byteLength) return false;
  const dv1 = new Uint8Array(ab1);
  const dv2 = new Uint8Array(ab2);
  for (let i = 0; i != ab1.byteLength; i++) {
    if (dv1[i] != dv2[i]) return false;
  }
  return true;
}

/**
 * @param {ArrayBuffer} expected 
 */
function compareArrayBufferTo(expected) {
  return /** @param {ArrayBuffer} candidate */ (candidate) => {
    return compareArrayBuffers(expected, candidate);
  }
}

/**
 * @param {string} signedPayload 
 * @param {string} secret 
 */
async function computeSignature(signedPayload, secret) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "HMAC" }, cryptoKey, new TextEncoder().encode(signedPayload));
  return signature;
}

const DEFAULT_TOLERANCE = 300; // 5 minutes

/**
 * @param {string} payload 
 * @param {string} header 
 * @param {string} secret 
 * @param {number=} tolerance
 */
export function constructEvent(payload, header, secret, tolerance) {
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
 *
 * @typedef {object} opts
 * @property {number} timestamp - Timestamp of the header. Defaults to Date.now()
 * @property {string} payload - JSON stringified payload object, containing the 'id' and 'object' parameters
 * @property {string} secret - Stripe webhook secret 'whsec_...'
 * @property {string} scheme - Version of API to hit. Defaults to 'v1'.
 * @property {string} signature - Computed webhook signature
 */
export async function generateTestHeaderString(opts) {
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

/**
 * @param {string} payload 
 * @param {string} header 
 * @param {string} secret 
 * @param {number} tolerance 
 */
async function verifyHeader(payload, header, secret, tolerance) {
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

/**
 * @param {string} header 
 * @param {string} scheme 
 * @returns {{ timestamp: number, signatures: string[] }}
 */
function parseHeader(header, scheme) {
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
