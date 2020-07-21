// ----------------------------
// Dependencies
// ----------------------------

class JSONResponse extends Response {
  /**
   * @param {any} [body] 
   * @param {ResponseInit} [init] 
   * @param {(this: any, key: string, value: any) => any} [replacer] 
   * @param {string | number} [space]
   */
  constructor(body, init, replacer, space) {
    const { headers: h, ...rest } = init || {};

    const b = body != null ? JSON.stringify(body, replacer, space) : null;

    const headers = new Headers(h);
    if (b) headers.set('Content-Type', 'application/json;charset=UTF-8');

    super(b, { headers, ...rest });
  }
}

/**
 * @param  {...Uint8Array} as 
 */
function concatUint8Arrays(...as) {
  const size = as.reduce((size, a) => size + a.length, 0);
  const c = new Uint8Array(size);
  let i = 0;
  for (const a of as) {
    c.set(a, i);
    i += a.length;
  }
  return c;
}

const byteToHex = byte => byte.toString(16).padStart(2, '0');
const hexToByte = hex => parseInt(hex, 16);

const _hexStringToBytes = hex => hex.match(/[0-9A-Za-z]{1,2}/g).map(hexToByte);

function _bytesToHexArray(uint8Array) {
  const hexArray = new Array(16);
  for (let i = 0; i < 16; i++) { hexArray[i] = byteToHex(uint8Array[i]) }
  return hexArray;
}

function _bytesToUUIDString(uint8Array) {
  const hexArray = _bytesToHexArray(uint8Array);
  hexArray.splice(4, 0, '-');
  hexArray.splice(7, 0, '-');
  hexArray.splice(10, 0, '-');
  hexArray.splice(13, 0, '-');
  return hexArray.join('');
}

function _v4() {
  const uuid = crypto.getRandomValues(new Uint8Array(16));

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  uuid[6] = (uuid[6] & 0x0f) | 0x40;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;

  return uuid.buffer;
}

function _fromString(str) {
  const hex = str.replace(/[^0-9A-Za-z]/g, '').slice(0, 32);
  if (hex.length < 32) throw Error('UUID too short');
  return _hexStringToBytes(hex);
}

const _uint8Array = new WeakMap();

/**
 * A better UUID class for JavaScript.
 * 
 * UUID are represented as bytes (`Uint8Array`) and converted to strings on-demand.
 * 
 * This class implements `toString` and `toJSON` for better language integration,
 * as well as inspection for node and Deno for a better development experience.
 * 
 * For the most part, `UUID` can be used where  UUID strings are used,
 * except for equality checks. For those cases, `UUID` provides quick access 
 * to the string representations via the `uuid` field.
 * 
 * @extends ArrayBufferView
 */
class UUID {
  /**
   * Generate a new UUID version 4 (random).
   */
  static v4() {
    return new UUID(_v4());
  }

  /**
   * @param {string} value 
   */
  static fromString(value) {
    return new UUID(_fromString(value));
  }

  /**
   * @param {string|ArrayLike<number>|ArrayBufferLike} [value] 
   *  Value from which to create this UUID. Leave empty to create a random (v4) UUID
   * @param {number} [byteOffset] 
   *  When `value` is an `ArrayBuffer`, can specify and offset in bytes from where to read.
   */
  constructor(value, byteOffset = 0) {
    if (value == null) {
      _uint8Array.set(this, new Uint8Array(_v4()));
    }
    else if (typeof value === 'string') {
      _uint8Array.set(this, new Uint8Array(_fromString(value)));
    }
    else if (value instanceof UUID) {
      _uint8Array.set(this, new Uint8Array(value.buffer.slice(0)));
    }
    else if (value instanceof ArrayBuffer) {
      if (value.byteLength - byteOffset < 16) throw Error('UUID too short');
      _uint8Array.set(this, new Uint8Array(value.slice(byteOffset, byteOffset + 16)));
    }
    else if ('length' in value) {
      const { length } = value;
      if (length < 16) throw Error('UUID too short');
      if (length === 16) _uint8Array.set(this, new Uint8Array(value));
      else if ('slice' in value) _uint8Array.set(this, new Uint8Array(value.slice(0, 16)));
      else _uint8Array.set(this, new Uint8Array(Array.prototype.slice.call(value, 0, 16)));
    }
    else {
      throw Error('Unsupported data type');
    }
  }

  /**
   * @returns {ArrayBufferLike}
   */
  get buffer() {
    return _uint8Array.get(this).buffer;
  }

  /**
   * @returns {number}
   */
  get byteLength() {
    return 16;
  }

  /**
   * @returns {number}
   */
  get byteOffset() {
    return 0;
  }

  /**
   * Quick access to the string representation for easier comparison.
   * Too bad JS doesn't support value types...
   * @example if (myUUID.uuid === otherUUID.uuid) { ... }
   */
  get uuid() {
    return _bytesToUUIDString(_uint8Array.get(this));
  }

  toString() {
    return _bytesToUUIDString(_uint8Array.get(this));
  }

  toJSON() {
    return _bytesToUUIDString(_uint8Array.get(this));
  }
}

(function (Object) {
  typeof globalThis !== 'object' && (
    this ?
      get() :
      (Object.defineProperty(Object.prototype, '_T_', {
        configurable: true,
        get: get
      }), _T_)
  );
  function get() {
    this.globalThis = this;
    delete Object.prototype._T_;
  }
}(Object));

/**
 * Slightly modernized version of [`base64-js`][1]. 
 * Performance is slightly improved due to pre-allocating arrays.
 * 
 * This version drops support for platforms that don't provide 
 * `Uint8Array` and `DataView`. Use the original in those cases.
 * 
 * [1]: https://github.com/beatgammit/base64-js
 * [2]: https://tools.ietf.org/html/rfc3986#section-2.3
 */

const b64lookup = [];
const urlLookup = [];
const revLookup = [];

const SAME = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_B64 = SAME + '+/';
const CODE_URL = SAME + '-_';
const PAD_B64 = '=';
const PAD_URL = '~';

const MAX_CHUNK_LENGTH = 16383; // must be multiple of 3

for (let i = 0, len = CODE_B64.length; i < len; ++i) {
  b64lookup[i] = CODE_B64[i];
  urlLookup[i] = CODE_URL[i];
  revLookup[CODE_B64.charCodeAt(i)] = i;
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62;
revLookup['_'.charCodeAt(0)] = 63;

function getLens (b64) {
  const len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  let validLen = b64.indexOf(PAD_B64);
  if (validLen === -1) validLen = b64.indexOf(PAD_URL);
  if (validLen === -1) validLen = len;

  const placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4);

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength(b64) {
  const [validLen, placeHoldersLen] = getLens(b64);
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength(validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

/**
 * Takes a base 64 string and converts it to an array buffer.
 * Accepts both regular Base64 and the URL-friendly variant,
 * where
 * - `+` => `-`,
 * - `/` => `_` and
 * - `=` => `~` (these are unreserved URI characters according to [RFC 3986][2])
 * 
 * [2]: https://tools.ietf.org/html/rfc3986#section-2.3
 * 
 * @param {string} str 
 *   A Base64 string in either regular or  URL-friendly representation
 * @returns {ArrayBuffer}
 *   The binary data as an `ArrayBuffer`.
 */
function toByteArray(str) {
  let tmp;
  const [validLen, placeHoldersLen] = getLens(str);

  const arr = new Uint8Array(_byteLength(validLen, placeHoldersLen));

  let curByte = 0;

  // if there are placeholders, only get up to the last complete 4 chars
  const len = placeHoldersLen > 0
    ? validLen - 4
    : validLen;

  let i;
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[str.charCodeAt(i    )] << 18) |
      (revLookup[str.charCodeAt(i + 1)] << 12) |
      (revLookup[str.charCodeAt(i + 2)] <<  6) |
      (revLookup[str.charCodeAt(i + 3)]      );
    arr[curByte++] = (tmp >> 16) & 0xff;
    arr[curByte++] = (tmp >>  8) & 0xff;
    arr[curByte++] = (tmp      ) & 0xff;
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[str.charCodeAt(i    )] <<  2) |
      (revLookup[str.charCodeAt(i + 1)] >>  4);
    arr[curByte++] =  tmp        & 0xff;
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[str.charCodeAt(i    )] << 10) |
      (revLookup[str.charCodeAt(i + 1)] <<  4) |
      (revLookup[str.charCodeAt(i + 2)] >>  2);
    arr[curByte++] = (tmp >>  8) & 0xff;
    arr[curByte++] =  tmp        & 0xff;
  }

  return arr.buffer
}

function tripletToBase64 (lookup, num) {
  return (
    lookup[num >> 18 & 0x3f] +
    lookup[num >> 12 & 0x3f] +
    lookup[num >>  6 & 0x3f] +
    lookup[num       & 0x3f]
  )
}

function encodeChunk (lookup, view, start, end) {
  let tmp;
  const output = new Array((end - start) / 3);
  for (let i = start, j = 0; i < end; i += 3, j++) {
    tmp =
      ((view.getUint8(i    ) << 16) & 0xff0000) +
      ((view.getUint8(i + 1) <<  8) & 0x00ff00) +
      ( view.getUint8(i + 2)        & 0x0000ff);
    output[j] = tripletToBase64(lookup, tmp);
  }
  return output.join('')
}

/**
 * Encodes binary data provided in an array buffer as a Base64 string.
 * @param {BufferSource} bufferSource The raw data to encode.
 * @param {boolean} [urlFriendly] Set to true to encode in a URL-friendly way.
 * @returns {string} The contents a Base64 string.
 */
function fromByteArray(bufferSource, urlFriendly = false) {
  const view = new DataView(bufferSource.buffer || bufferSource);
  const len = view.byteLength;
  const extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  const len2 = len - extraBytes;
  const parts = new Array(
    Math.floor(len2 / MAX_CHUNK_LENGTH) + Math.sign(extraBytes)
  );
  const lookup = urlFriendly ? urlLookup : b64lookup;
  const pad = urlFriendly ? PAD_URL : PAD_B64;

  // Go through the array every three bytes, we'll deal with trailing stuff 
  // later
  let j = 0;
  for (let i = 0; i < len2; i += MAX_CHUNK_LENGTH) {
    parts[j++] = encodeChunk(
      lookup,
      view, 
      i, 
      (i + MAX_CHUNK_LENGTH) > len2 ? len2 : (i + MAX_CHUNK_LENGTH),
    );
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    let tmp = view.getUint8(len - 1);
    parts[j] = (
      lookup[ tmp >>  2]         +
      lookup[(tmp <<  4) & 0x3f] +
      pad + pad
    );
  } else if (extraBytes === 2) {
    let tmp = (view.getUint8(len - 2) << 8) + view.getUint8(len - 1);
    parts[j] = (
      lookup[ tmp >> 10]         +
      lookup[(tmp >>  4) & 0x3f] +
      lookup[(tmp <<  2) & 0x3f] +
      pad
    );
  }

  return parts.join('')
}


var jsImpl = Object.freeze({
	byteLength: byteLength,
	toByteArray: toByteArray,
	fromByteArray: fromByteArray,
	encode: fromByteArray,
	decode: toByteArray
});

const WASM = `
AGFzbQEAAAABFwRgAABgAX8Bf2ACf38Bf2AEf39/fwF/AwYFAAECAQMEBQFwAQEBBQMBAAIGIQV/AUGg
iwQLfwBBgAgLfwBBkQsLfwBBgAgLfwBBoIsECwecAQoGbWVtb3J5AgARX193YXNtX2NhbGxfY3RvcnMA
ABBCYXNlNjRkZWNvZGVfbGVuAAEMQmFzZTY0ZGVjb2RlAAIQQmFzZTY0ZW5jb2RlX2xlbgADDEJhc2U2
NGVuY29kZQAEDF9fZHNvX2hhbmRsZQMBCl9fZGF0YV9lbmQDAg1fX2dsb2JhbF9iYXNlAwMLX19oZWFw
X2Jhc2UDBAqqBwUCAAs+AQN/IAAhAQNAIAEtAAAhAiABQQFqIgMhASACQYCIgIAAai0AAEHAAEkNAAsg
AyAAa0ECakEEbUEDbEEBagvYAwEGfyABIQIDQCACLQAAIQMgAkEBaiIEIQIgA0GAiICAAGotAABBwABJ
DQALIAQgAUF/c2oiAkEDakEEbSEFAkAgAkEFSA0AIAQgAWsiBkF6aiEHA0AgACABQQFqIgMtAABBgIiA
gABqLQAAQQR2IAEtAABBgIiAgABqLQAAQQJ0cjoAACAAQQFqIAFBAmoiBC0AAEGAiICAAGotAABBAnYg
Ay0AAEGAiICAAGotAABBBHRyOgAAIABBAmogAUEDai0AAEGAiICAAGotAAAgBC0AAEGAiICAAGotAABB
BnRyOgAAIABBA2ohACABQQRqIQEgAkF8aiICQQRKDQALIAYgB0F8cWtBe2ohAgsgBUEDbCEDAkAgAkEC
SA0AIAAgAS0AAUGAiICAAGotAABBBHYgAS0AAEGAiICAAGotAABBAnRyOgAAAkAgAkECRw0AIABBAWoh
AAwBCyAAIAEtAAJBgIiAgABqLQAAQQJ2IAEtAAFBgIiAgABqLQAAQQR0cjoAAQJAIAJBBE4NACAAQQJq
IQAMAQsgACABLQADQYCIgIAAai0AACABLQACQYCIgIAAai0AAEEGdHI6AAIgAEEDaiEACyAAQQA6AAAg
A0EAIAJrQQNxawsQACAAQQJqQQNtQQJ0QQFyC/oCAQZ/QYCKgIAAQdCKgIAAIANBAUYiBBshBUEAIQYC
QAJAIAJBfmoiB0EBTg0AIAAhAwwBCyAAIQMDQCADIAUgASAGaiIILQAAQQJ2ai0AADoAACADQQFqIAUg
CC0AAEEEdEEwcSAIQQFqIgktAABBBHZyai0AADoAACADQQJqIAUgCS0AAEECdEE8cSAIQQJqIggtAABB
BnZyai0AADoAACADQQNqIAUgCC0AAEE/cWotAAA6AAAgA0EEaiEDIAZBA2oiBiAHSA0ACwsCQCAGIAJO
DQBB/gBBPSAEGyEIIAMgBSABIAZqIgktAABBAnZqLQAAOgAAIAktAABBBHRBMHEhAQJAAkAgBiACQX9q
Rw0AIAMgBSABai0AADoAASAIIQUMAQsgAyAFIAlBAWoiBi0AAEEEdiABcmotAAA6AAEgBSAGLQAAQQJ0
QTxxai0AACEFCyADIAg6AAMgAyAFOgACIANBBGohAwsgA0EAOgAAIAMgAGtBAWoLC5kDAQBBgAgLkQNA
QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAPkA+QD80NTY3ODk6Ozw9QEBA
QEBAQAABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZQEBAQD9AGhscHR4fICEiIyQlJicoKSorLC0uLzAx
MjNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA
QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA
QEBAQEBAQEBAQEBAQEBAQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJz
dHV2d3h5ejAxMjM0NTY3ODktXwAAAAAAAAAAAAAAAAAAAABBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZ
WmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvAABbBG5hbWUBVAUAEV9fd2FzbV9j
YWxsX2N0b3JzARBCYXNlNjRkZWNvZGVfbGVuAgxCYXNlNjRkZWNvZGUDEEJhc2U2NGVuY29kZV9sZW4E
DEJhc2U2NGVuY29kZQAlCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQVjbGFuZwU5LjAuMQ==
`.trim().replace(/\n/g, '');

const BYTES_PER_PAGE = 64 * 1024;

function ensureMemory(memory, pointer, targetLength) {
  const availableMemory = memory.buffer.byteLength - pointer;
  if (availableMemory < targetLength) {
    const nPages = Math.ceil((targetLength - availableMemory) / BYTES_PER_PAGE);
    memory.grow(nPages);
  }
}

function textEncodeInto(uint8, str) {
  if ('encodeInto' in TextEncoder.prototype) {
    new TextEncoder().encodeInto(str, uint8);
  } else {
    uint8.set(new TextEncoder().encode(str));
  }
  return uint8;
}

function textEncodeIntoMemory(instance, memory, str) {
  const pBufCoded = instance.exports.__heap_base.value;
  const bufCodedLen = str.length;
  ensureMemory(memory, pBufCoded, bufCodedLen);

  const bufCoded = new Uint8Array(memory.buffer, pBufCoded, bufCodedLen + 1);
  textEncodeInto(bufCoded, str);
  bufCoded[bufCodedLen] = '\0';

  return [pBufCoded, bufCodedLen]
}

function decode(instance, str) {
  const { memory } = instance.exports;

  const [pBufCoded, bufCodedLen] = textEncodeIntoMemory(instance, memory, str);

  const pBufPlain = pBufCoded + bufCodedLen;
  const bufPlainLen = instance.exports.Base64decode_len(pBufCoded);
  ensureMemory(memory, pBufPlain, bufPlainLen);

  const lenReal = instance.exports.Base64decode(pBufPlain, pBufCoded);
  const bufPlain = new Uint8Array(memory.buffer, pBufPlain, lenReal);

  // Return a copy
  // NOTE: We could return a view directly into WASM memory for some efficiency 
  // gains, but this would require that the caller understands that it will be
  // overwritten upon next use.
  return new Uint8Array(bufPlain).buffer;
}

function writeIntoMemory(instance, memory, arrayBuffer) {
  const pString = instance.exports.__heap_base.value;
  const stringLen = arrayBuffer.byteLength;
  ensureMemory(memory, pString, stringLen);

  // +1 so we so we have an extra byte for the string termination char '\0'
  const string = new Uint8Array(memory.buffer, pString, stringLen + 1);
  string.set(new Uint8Array(arrayBuffer));
  string[stringLen] = '\0';

  return [pString, stringLen];
}

function encode(instance, arrayBuffer, urlFriendly) {
  // console.time('wasm');
  const { memory}  = instance.exports;

  const [pString, stringLen] = writeIntoMemory(instance, memory, arrayBuffer);

  const pEncoded = pString + stringLen;
  const encodedLen = instance.exports.Base64encode_len(stringLen);
  ensureMemory(memory, pEncoded, encodedLen);

  // -1 so we don't include string termination char '\0'
  const encoded = new Uint8Array(memory.buffer, pEncoded, encodedLen - 1);

  instance.exports.Base64encode(
    pEncoded, 
    pString, 
    stringLen, 
    urlFriendly ? 1 : 0,
  );
  // console.timeEnd('wasm');

  // NOTE: Interestingly, most of the runtime is spent building the string.
  //       As far as I know, this is still the fastest way.
  // console.time('text');
  const str = new TextDecoder().decode(encoded);
  // console.timeEnd('text');

  return str;
}

class WASMImpl {
  async init() {
    const { instance } = await WebAssembly.instantiate(toByteArray(WASM));
    this.instance = instance;
    return this;
  }

  encode(arrayBuffer, urlFriendly) {
    return encode(this.instance, arrayBuffer, urlFriendly);
  }

  decode(string) { 
    return decode(this.instance, string);
  }
}

const _impl = new WeakMap();
const _initPromise = new WeakMap();
const _urlFriendly = new WeakMap();

class Base64 {
  constructor() {
    if (!'Uint8Array' in globalThis && 'DataView' in globalThis) {
      throw Error(
        'Platform unsupported. Make sure Uint8Array and DataView exist'
      );
    }

    _impl.set(this, jsImpl);

    if ('WebAssembly' in globalThis) {
      _initPromise.set(this, new WASMImpl().init().then((impl) => {
        _impl.set(this, impl);
        return this;
      }).catch(() => {
        _impl.set(this, jsImpl);
        return this;
      }));
    } else {
      _initPromise.set(this, Promise.resolve(this));
    }
  }

  /** 
   * @returns {Promise<this>}
   */
  get initialized() {
    return _initPromise.get(this);
  }
}

class Base64Encoder extends Base64 {
  /**
   * Set to encode URL friendly Base64.
   * Decoding is not affected.
   * @param {boolean} urlFriendly;
   */
  set urlFriendly(urlFriendly) {
    _urlFriendly.set(this, urlFriendly);
  };

  /**
   * @returns {boolean}
   */
  get urlFriendly() {
    return _urlFriendly.get(this);
  };

  /**
   * @param {{ urlFriendly?: boolean }} [options]
   */
  constructor({ urlFriendly = false } = {}) {
    super();
    _urlFriendly.set(this, urlFriendly);
  }

  /** 
   * @param {ArrayBuffer} arrayBuffer
   * @returns {string}
   */
  encode(arrayBuffer) {
    return _impl.get(this).encode(arrayBuffer, this.urlFriendly);
  }
}

class Base64Decoder extends Base64 {
  /** 
   * @param {string} string
   * @returns {ArrayBuffer}
   */
  decode(string) {
    return _impl.get(this).decode(string);
  }
}

const b64d = new Base64Decoder();
const b64e = new Base64Encoder();

/** @param {string} str */
function _fromWebUUIDString(str) {
  if (str && str.length === 24) {
    return b64d.decode(str);
  }
  return b64d.decode(`${str}==`);
}

function _toWebUUIDString(webUUID) {
    b64e.urlFriendly = true;
    return b64e.encode(webUUID.buffer).slice(0, 22);
}

/**
 * Better UUIDs for the web.
 * 
 * WebUUIDs are UUIDs that stringify to a shorter 22 character URL-friendly Base64 representation of the same underlying 128 bit data. 
 * In other words, each WebUUID maps to exactly one UUID and vice versa.
 * 
 *    7Wcs1mlrTSKpd_NELaEMHQ <=> ed672cd6-696b-4d22-a977-f3442da10c1d
 * 
 * URL-friendly Base64 is just like regular Base64, except `+` maps to `-` and `/` maps to `_`, both unreserved characters in the URI spec.
 * 
 * WebUUIDs are built for web developers to build more compact URLs without losing the benefits of UUIDs or sacrificing backwards compatibility.
 * When using `WebUUIDs` where a string is expected, or when `JSON.stringify`-ing data that contains a `WebUUID`, it will map to the WebUUID (base64 / 22 char) format.
 * The regular UUID representation is always accessible via the `.uuid` property.
 * `WebUUID`s are a subtype of `Uint8Array` and can be used wherever binary data is expected.
 * 
 * ```js
 * const u = WebUUID.from('7Wcs1mlrTSKpd_NELaEMHQ') 
 * const v = WebUUID.from('ed672cd6-696b-4d22-a977-f3442da10c1d')
 * u.uuid === v.uuid // => true
 * ```
 * 
 * ## Parsing
 * Because WebUUIDs are just Base64 encoded bits of data, the tools to parse them already exist on every platform. 
 * E.g. Ruby:
 * 
 * ```ruby
 * require 'base64'
 * str = web_uuid.gsub('-', '+').gsub('_', '/') + '=='
 * hx = Base64.strict_decode64(str).each_byte.map { |b| b.to_s(16).rjust(2, '0') }.join
 * uuid = [hx[0..7], hx[8..11], hx[12..15], hx[16..19], hx[20..31]].join '-'
 * ```
 * Note that WebUUIDs always have a padding of 2, which follow from UUIDs being 16 bytes = 128 bits,
 * the number of bits being encoded by 1 out of 64 characters being `log2(64) = 6`, and `128 % 6 = 2`.
 * 
 * Many languages have good built-in support for URL-safe Base64 and UUIDs:
 * 
 * Python:
 * ```python
 * import base64
 * import uuid
 * bs = base64.urlsafe_b64decode('{}=='.format(web_uuid))
 * uuid.UUID(bytes=bs)
 * ```
 * 
 * Rust:
 * ```rust
 * extern crate base64;
 * extern crate uuid;
 * let mut bytes: [u8; 16] = [0; 16];
 * base64::decode_config_slice(&web_uuid, base64::URL_SAFE_NO_PAD, &mut bytes);
 * let uuid = uuid::Uuid::from_bytes(bytes);
 * ```
 */
class WebUUID extends UUID {
  static v4() {
    return new WebUUID();
  }

  /** @param {string} str */
  static fromString(str) {
    return new WebUUID(_fromWebUUIDString(str));
  }

  /**
   * @param {string|ArrayLike<number>|ArrayBufferLike} [value] 
   *  Value from which to create this UUID. Leave empty to create a random (v4) UUID
   * @param {number} [byteOffset] 
   *  When `value` is an `ArrayBuffer`, can specify and offset in bytes from where to read.
   */
  constructor(value, byteOffset) {
    if (typeof value === 'string' && (value.length === 22 || value.length === 24)) {
      super(_fromString(value));
    } else {
      super(value, byteOffset);
    }
  }

  get wid() {
    return _toWebUUIDString(this);
  }

  get uuid() {
    return super.toString();
  }

  get base64() {
    b64e.urlFriendly = false;
    return b64e.encode(this.buffer);
  }

  toUUID() {
    return new UUID(this.buffer);
  }

  toString() {
    return _toWebUUIDString(this);
  }

  toJSON() {
    return _toWebUUIDString(this);
  }
}

//--------------------------
// User Code
//--------------------------
const CORS_HEADERS = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma',
});

const EMPTY_UINT8 = new Uint8Array([]);

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)))
});

/**
 * @param {URL} url 
 * @param {string} [id]
 */
async function makeKey(url, id) {
  const keyUrl = new URL(url.searchParams.get('url') || 'https://hydejack.com/');
  keyUrl.search = '';
  keyUrl.hash = '';
  const urlBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyUrl.href)));
  // const idUint8Array = id ? new Uint8Array(new UUID(id).buffer) : EMPTY_UINT8;
  const urlB64 = new Base64Encoder({ urlFriendly: true }).encode(urlBytes);
  const idB64 = id ? new WebUUID(id).wid : '';
  return `${urlB64}/${idB64}`;
}

/**
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleRequest(request, url) {
  switch (url.pathname) {
    case '/update-claps': {
      if (request.method === 'POST') {
        const { claps, id } = await request.json();
        const key = await makeKey(url, id);
        console.log(key)
        const value = Number(await APPLAUSE_KV.get(key)) || 0;
        const newValue = value + claps || value;
        await APPLAUSE_KV.put(key, newValue);
        return new JSONResponse(newValue, { headers: CORS_HEADERS });
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        const prefix = await makeKey(url);
        // TODO: pagination
        const { keys } = await APPLAUSE_KV.list({ prefix });
        let sum = 0;
        for (const { name: key } of keys) {
          sum += Number(await APPLAUSE_KV.get(key)) || 0;
        }
        return new JSONResponse(sum, { headers: CORS_HEADERS });
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    default: {
      return new Response(null, { headers: CORS_HEADERS, status: 404 });
    }
  }
}
