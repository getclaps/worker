export class JSONResponse extends Response {
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

function isPOJO(arg) {
  if (arg == null || typeof arg !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(arg);
  if (proto == null) {
    return true; // `Object.create(null)`
  }
  return proto === Object.prototype;
}

export class JSONRequest extends Request {
  /**
   * @param {RequestInfo | URL} input 
   * @param {RequestInit} [init] 
   * @param {(this: any, key: string, value: any) => any} [replacer] 
   * @param {string | number} [space]
   */
  constructor(input, init, replacer, space) {
    const { headers: h, body: b, ...rest } = init || {};

    const isJSON = b && isPOJO(b);
    const body = isJSON ? JSON.stringify(b, replacer, space) : b;

    const headers = new Headers(h);
    headers.set('Accept', 'application/json, text/plain, */*');
    if (isJSON) headers.set('Content-Type', 'application/json;charset=UTF-8');

    super(input instanceof URL ? input.href : input, { headers, body, ...rest });
  }
}

/**
 * @param {string} url 
 * @param {Object<string, any>} [params] 
 * @param {string|URL} [base] 
 */
export const urlWithParams = (url, params, base) => {
  const u = new URL(url, base || self.location.origin);
  if (params) {
    // @ts-ignore
    u.search = new URLSearchParams([...u.searchParams, ...Object.entries(params)]).toString();
  }
  return u.href;
}
