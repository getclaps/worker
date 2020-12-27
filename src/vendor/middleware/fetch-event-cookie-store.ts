import { SyncCookieStore, CookieListItem, CookieList, CookieInit } from "./cookie-store-types";

const attrsToSetCookie = (attrs: string[][]) => attrs.map(as => as.join('=')).join('; ');

export class FetchEventCookieStore implements SyncCookieStore {
  #origin: URL;
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

  get(name: string): CookieListItem | null;
  // get(options?: CookieStoreGetOptions): CookieListItem | null;
  get(options: string) {
    return this.#cookie.has(options) 
      ? { name: options, value: this.#cookie.get(options) } 
      : null;
  }

  getAll(name: string): CookieList;
  // getAll(options?: CookieStoreGetOptions): CookieList;
  getAll() {
    return [...this.#cookie.entries()].map(([name, value]) => ({ name, value }))
  }

  set(name: string, value: string): void;
  set(options: CookieInit): void;
  set(options: string | CookieInit, value?: string) {
    const [name, val, attributes, expires] = setCookie(options, value, this.#origin);
    this.#setMap.set(name, attributes);
    if (expires < new Date()) this.#cookie.delete(name); else this.#cookie.set(name, val);
  }

  delete(name: string): void;
  // delete(options: CookieStoreDeleteOptions): void;
  delete(options: string) {
    const expires = new Date(0);
    const value = '';
    const sameSite = 'strict';
    this.set({ name: options, expires, value, sameSite });
  }

  toString() { return [...this.#cookie.entries()].map(x => x.join('=')).join('; ') }

  *headers(): IterableIterator<[string, string]> {
    for (const attrs of this.#setMap.values()) {
      yield ['Set-Cookie', attrsToSetCookie(attrs)]
    }
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

  return [name, val, attrs, expires] as [string, string, string[][], Date];
}

/**
 * Helper to turn cookie inits into set-cookie strings.
 * @param cookie 
 */
export const toSetCookie = (cookie: CookieInit): string => {
  const [, , attrs] = setCookie(cookie)
  return attrsToSetCookie(attrs)
}
