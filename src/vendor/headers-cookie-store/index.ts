import { CookieStore, CookieListItem, CookieList, CookieInit, CookieStoreGetOptions, CookieStoreDeleteOptions } from "./cookie-store-interface";

import { setCookie, attrsToSetCookie } from './set-cookie';

/**
 * An implementation of the [Cookie Store API](https://wicg.github.io/cookie-store) for request handlers. 
 * 
 * The class takes a `Headers` object, parses the `Cookie` header, and populates the store with the results.
 * Changes to the store are recorded and can be exported as a list of `Set-Cookie` headers.
 * 
 * This makes it useful for server-side cookie middleware.
 * It was written to be used in @werker/middleware, but published here as a standalone module for use elsewhere.
 */
export class HeadersCookieStore implements CookieStore {
  #origin: URL | null;
  #store: Map<string, string> = new Map();
  #changes: Map<string, string[][]> = new Map();

  constructor(headers: Headers) {
    const origin = headers.get('origin');
    const cookie = headers.get('cookie');

    this.#origin = (origin && new URL(origin)) || null;

    // TODO: replace with spec-compliant parser!?
    this.#store = new Map(cookie?.split(/;\s*/)
      .map(x => x.split('='))
      .map(([k, v]) => [k, v] as [string, string])
      .filter(([k]) => !!k));
  }

  async get(options: string | CookieStoreGetOptions): Promise<CookieListItem> {
    if (typeof options !== 'string') throw Error('Overload not implemented.');

    return this.#store.has(options)
      ? { name: options, value: this.#store.get(options) }
      : null;
  }

  async getAll(options?: string | CookieStoreGetOptions): Promise<CookieList> {
    if (options != null) throw Error('Overload not implemented.');

    return [...this.#store.entries()].map(([name, value]) => ({ name, value }))
  }

  async set(options: string | CookieInit, value?: string) {
    const [name, val, attributes, expires] = setCookie(options, value, this.#origin);
    this.#changes.set(name, attributes);
    if (expires && expires < new Date()) 
      this.#store.delete(name); 
    else 
      this.#store.set(name, val);
  }

  async delete(options: string | CookieStoreDeleteOptions) {
    if (typeof options !== 'string') throw Error('Overload not implemented.');

    const expires = new Date(0);
    const value = '';
    const sameSite = 'strict';
    this.set({ name: options, expires, value, sameSite });
  }

  /** 
   * Exports the recorded changes to this store as a list of  `Set-Cookie` headers.
   * This can be passed to the headers field of a `Response` constructor.
   */
  headers(): [string, string][] {
    const headers = [];
    for (const attrs of this.#changes.values()) {
      headers.push(['Set-Cookie', attrsToSetCookie(attrs)]);
    }
    return headers;
  }

  /** Helper to turn cookie inits into set-cookie strings. */
  static toSetCookie(cookie: CookieInit): string {
    const [, , attrs] = setCookie(cookie);
    return attrsToSetCookie(attrs);
  }

  /** Exports the cookie store as a cookie string, similar to `document.cookie` or `Cookie` header. */
  toCookieString() { 
    return [...this.#store.entries()].map(x => x.join('=')).join('; ') 
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void { throw new Error("Method not implemented.") }
  dispatchEvent(event: Event): boolean { throw new Error("Method not implemented.") }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void { throw new Error("Method not implemented.") }
}

export * from './cookie-store-interface';
