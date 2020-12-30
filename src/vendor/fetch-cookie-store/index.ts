import { CookieStore, CookieListItem, CookieList, CookieInit, CookieStoreGetOptions, CookieStoreDeleteOptions } from "./cookie-store-interface";

const attrsToSetCookie = (attrs: string[][]) => attrs.map(as => as.join('=')).join('; ');

/**
 * An implementation of the [Cookie Store API](https://wicg.github.io/cookie-store) for request handlers. 
 * 
 * The implementation will parse the `Cookie` header of the request to populate the store.
 * 
 * Modifications to the store are recorded and can be exported as a list of `Set-Cookie` headers. 
 * This makes it useful for server-side cookie middleware.
 * It was written to be used in @werker/middleware, but published here as a standalone module for use elsewhere.
 */
export class FetchCookieStore implements CookieStore {
  #origin: URL | null;
  #cookie: Map<string, string> = new Map();
  #setMap: Map<string, string[][]> = new Map();

  constructor(request: Request) {
    const origin = request.headers.get('origin');
    const cookie = request.headers.get('cookie');

    this.#origin = (origin && new URL(origin)) || null;

    // TODO: replace with spec-compliant parser!?
    this.#cookie = new Map(cookie?.split(/;\s*/)
      .map(x => x.split('='))
      .map(([k, v]) => [k, v] as [string, string])
      .filter(([k]) => !!k));
  }

  async get(options: string | CookieStoreGetOptions): Promise<CookieListItem> {
    if (typeof options !== 'string') throw Error('Overload not implemented.');

    return this.#cookie.has(options)
      ? { name: options, value: this.#cookie.get(options) }
      : null;
  }

  async getAll(options?: string | CookieStoreGetOptions): Promise<CookieList> {
    if (typeof options !== 'string') throw Error('Overload not implemented.');

    return [...this.#cookie.entries()].map(([name, value]) => ({ name, value }))
  }

  async set(options: string | CookieInit, value?: string) {
    const [name, val, attributes, expires] = setCookie(options, value, this.#origin);
    this.#setMap.set(name, attributes);
    if (expires && expires < new Date()) 
      this.#cookie.delete(name); 
    else 
      this.#cookie.set(name, val);
  }

  async delete(options: string | CookieStoreDeleteOptions) {
    if (typeof options !== 'string') throw Error('Overload not implemented.');

    const expires = new Date(0);
    const value = '';
    const sameSite = 'strict';
    this.set({ name: options, expires, value, sameSite });
  }

  // TODO: rename?
  toString() { 
    return [...this.#cookie.entries()].map(x => x.join('=')).join('; ') 
  }

  *headers(): IterableIterator<[string, string]> {
    for (const attrs of this.#setMap.values()) {
      yield ['Set-Cookie', attrsToSetCookie(attrs)]
    }
  }

  /**
   * Helper to turn cookie inits into set-cookie strings.
   */
  static toSetCookie(cookie: CookieInit): string {
    const [, , attrs] = setCookie(cookie);
    return attrsToSetCookie(attrs);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void { throw new Error("Method not implemented.") }
  dispatchEvent(event: Event): boolean { throw new Error("Method not implemented.") }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void { throw new Error("Method not implemented.") }
}

function setCookie(options: string | CookieInit, value?: string, origin?: URL) {
  const [name, val] = typeof options === 'string'
    ? [options, value]
    : [options.name, options.value ?? '']

  if (!name.length && val.includes('=')) throw Error()
  if (!name.length && !val.length) throw Error();

  const attrs = [[name, val]];
  const host = origin?.host;
  let expires = null;

  if (typeof options !== 'string') {
    const { domain, path = '/', sameSite } = options;

    if (domain) {
      if (domain.startsWith('.')) throw Error();
      if (host && !host.endsWith(`.${domain}`)) throw Error()
      attrs.push(['Domain', domain]);
    }

    if (options.expires) {
      expires = options.expires instanceof Date
        ? options.expires
        : new Date(options.expires);
      attrs.push(['Expires', expires.toUTCString()]);
    }

    attrs.push(['Path', path]);

    if (origin && origin.hostname !== 'localhost')
      attrs.push(['Secure']);

    if (options.httpOnly)
      attrs.push(['HttpOnly']);

    switch (sameSite) {
      case 'none': attrs.push(['SameSite', 'None']); break;
      case 'lax': attrs.push(['SameSite', 'Lax']); break;
      case 'strict': attrs.push(['SameSite', 'Strict']); break;
    }
  }

  return [name, val, attrs, expires] as [string, string, string[][], Date|null];
}

export * from './cookie-store-interface';
