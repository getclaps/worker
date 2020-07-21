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
