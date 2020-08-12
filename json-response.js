export class SearchParamsURL extends URL {
  /**
   * @param {string | URL} url 
   * @param {{ [name: string]: string }} [params] 
   * @param {string | URL} [base] 
   */
  constructor(url, params = {}, base) {
    super(url.toString(), base);
    for (const [k, v] of Object.entries(params)) this.searchParams.append(k, v);
  }
}

export {
  SearchParamsURL as SearchURL,
  SearchParamsURL as ParamsURL,
}

/** @typedef {BodyInit | object} JSONBodyInit */
/** @typedef {Omit<RequestInit, 'body'> & { body?: JSONBodyInit | null }} JSONRequestInit */

// function isPOJO(arg) {
//   if (arg == null || typeof arg !== 'object') {
//     return false;
//   }
//   const proto = Object.getPrototypeOf(arg);
//   if (proto == null) {
//     return true; // `Object.create(null)`
//   }
//   return proto === Object.prototype;
// }

/**
 * @param {JSONBodyInit} b 
 */
function isBodyInit(b) {
  return (
    b == null || 
    typeof b === 'string' ||
    (typeof Blob !== 'undefined' && b instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && (b instanceof ArrayBuffer || ArrayBuffer.isView(b))) ||
    (typeof FormData !== 'undefined' && b instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' && b instanceof ReadableStream)
  );
}

export class JSONRequest extends Request {
  /**
   * @param {RequestInfo | URL} input 
   * @param {JSONRequestInit} [init]
   * @param {(this: any, key: string, value: any) => any} [replacer] 
   * @param {string | number} [space] 
   */
  constructor(input, init, replacer, space) {
    const { headers: h, body: b, ...i } = init || {};

    const bi = isBodyInit(b);
    const body = bi ? b : JSON.stringify(b, replacer, space);

    const headers = new Headers(h);
    if (!headers.has('Content-Type') && !bi) headers.set('Content-Type', JSONRequest.contentType);
    if (!headers.has('Accept')) headers.set('Accept', JSONRequest.accept);

    super(input instanceof URL ? input.toString() : input, { headers, body, ...i });
  }
}
JSONRequest.contentType = 'application/json;charset=UTF-8';
JSONRequest.accept = 'application/json, text/plain, */*';


export class JSONResponse extends Response {
  /**
   * @param {JSONBodyInit | null} body 
   * @param {ResponseInit} [init] 
   * @param {(this: any, key: string, value: any) => any} [replacer] 
   * @param {string | number} [space] 
   */
  constructor(body, init, replacer, space) {
    const { headers: h, ...i } = init || {};

    const bi = isBodyInit(body)
    const b = bi ? body : JSON.stringify(body, replacer, space);

    const headers = new Headers(h);
    if (!headers.has('Content-Type') && !bi) headers.set('Content-Type', JSONResponse.contentType);

    super(b, { headers, ...i });
  }
}
JSONResponse.contentType = 'application/json;charset=UTF-8';

/**
 * @param {string|URL} url 
 * @param {{ [name: string]: string }} [params] 
 * @param {string | URL} [base] 
 * @deprecated Use {@link SearchParamsURL} instead
 */
export const urlWithParams = (url, params, base) => {
  return new SearchParamsURL(url, params, base).href;
}

/**
 * @param {JSONRequest | string | URL} input 
 * @param {JSONRequestInit} [init]
 * @param {(this: any, key: string, value: any) => any} [replacer] 
 * @param {string | number} [space] 
 */
export function jsonFetch(input, init, replacer, space) {
  return fetch(new JSONRequest(input, init, replacer, space));
}
