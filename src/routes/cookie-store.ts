import { Awaitable } from "../router";
import { CookieStore, CookieListItem, CookieList, CookieInit } from "./cookie-store-types";
import { validateURL } from "./validate";

type WithCookiesHandler<T> = (args: T & { cookies: CookieStore }) => Awaitable<Response>;

const attrsToSetCookie = (attrs: string[][]) => attrs.map(as => as.join('=')).join('; ');

class RequestCookieStore implements CookieStore {
  #origin: URL;
  #cookie: Map<string, string> = new Map();
  #setMap: Map<string, string[][]> = new Map();

  constructor(request: Request) {
    const origin = request.headers.get('host');
    const cookie = request.headers.get('cookie');

    this.#origin = (origin && validateURL(origin)) || null;

    // TODO: replace with spec-compliant parser!?
    this.#cookie = new Map(cookie?.split(/;\s*/)
      .map(x => x.split('='))
      .map(([k, v]) => [k, v] as [string, string])
      .filter(([k]) => !!k));
  }

  get(name: string): Promise<CookieListItem | null>;
  // get(options?: CookieStoreGetOptions): Promise<CookieListItem | null>;
  async get(options: string) {
    return this.#cookie.has(options) 
      ? { name: options, value: this.#cookie.get(options) } 
      : null;
  }

  getAll(name: string): Promise<CookieList>;
  // getAll(options?: CookieStoreGetOptions): Promise<CookieList>;
  async getAll() {
    return [...this.#cookie.entries()].map(([name, value]) => ({ name, value }))
  }

  set(name: string, value: string): Promise<void>;
  set(options: CookieInit): Promise<void>;
  async set(options: string | CookieInit, value?: string) {
    const [name, val, attributes, expires] = setCookie(options, value, this.#origin);
    this.#setMap.set(name, attributes);
    if (expires < new Date()) this.#cookie.delete(name); else this.#cookie.set(name, val);
  }

  delete(name: string): Promise<void>;
  // delete(options: CookieStoreDeleteOptions): Promise<void>;
  async delete(options: string) {
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

    if (this.origin.hostname !== 'localhost') 
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

export const withCookies = <T extends { event: FetchEvent }>(handler: WithCookiesHandler<T>) => async (args: T): Promise<Response> => {
  const cookies = new RequestCookieStore(args.event.request);
  const result = await handler({ ...args, cookies });
  for (const [, cookie] of cookies.headers()) 
    // NOTE that this does not work in service workers, because the implement Headers according to spec,
    // which cannot represent multiple set-cookie headers (per design).
    result.headers.append('Set-Cookie', cookie);
  return result;
}

/**
 * Helper to turns cookie inits into set-cookie strings.
 * @param cookie 
 */
export const toSetCookie = (cookie: CookieInit): string => {
  const [, , attrs] = setCookie(cookie)
  return attrsToSetCookie(attrs)
}

export * from './cookie-store-types';
