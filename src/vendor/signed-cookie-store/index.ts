import { UUID } from "uuid-class";
import { bufferSourceToUint8Array } from "typed-array-utils";
import { Base64Decoder, Base64Encoder } from "base64-encoding";

import { CookieInit, CookieList, CookieListItem, CookieStore, CookieStoreDeleteOptions, CookieStoreGetOptions } from "../fetch-cookie-store/cookie-store-interface";
import { Awaitable } from "../common-types";

/** 
 * The prefix to designate cookie signatures cookies. 
 * While pretty arbitrary, the `~` char makes signatures appear at the bottom when sorting alphabetically.
 */
const PREFIX = '~s~';

const secretToUint8Array = (secret: string | BufferSource) => typeof secret === 'string'
  ? new TextEncoder().encode(secret)
  : bufferSourceToUint8Array(secret);

/**
 * An implementation of the [Cookie Store API](https://wicg.github.io/cookie-store)
 * that transparently signs and verifies cookies via the Web Cryptography API. 
 * 
 * This is likely only useful in server-side implementations, but the code is written in a platform-agnostic way.
 * 
 * It was written to be used in @werker/middleware, but published here as a standalone module for use elsewhere.
 */
export class SignedCookieStore implements CookieStore {
  static async deriveCryptoKey(opts: { secret: string | BufferSource, salt?: BufferSource }) {
    if (!opts.secret) throw Error('Secret missing');

    const passphraseKey = await crypto.subtle.importKey('raw', secretToUint8Array(opts.secret), 'PBKDF2', false, ['deriveKey']);
    const salt = (opts.salt && bufferSourceToUint8Array(opts.salt)) ?? new UUID('a3491c45-b769-447f-87fd-64333c8d36f0');
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', iterations: 999, hash: 'SHA-256', salt },
      passphraseKey,
      { name: 'HMAC', hash: 'SHA-256', length: 128 },
      false,
      ['sign', 'verify'],
    );
  }

  #store: CookieStore;
  #key: Awaitable<CryptoKey>;

  constructor(store: CookieStore, signingKey: Awaitable<CryptoKey>) {
    this.#store = store;
    this.#key = signingKey;
  }

  #verify = async (cookie: CookieListItem, sigCookie: CookieListItem) => {
    const signature = new Base64Decoder().decode(sigCookie.value);
    const message = new TextEncoder().encode([cookie.name, cookie.value].join('='));
    const ok = await crypto.subtle.verify('HMAC', await this.#key, signature, message);
    if (!ok) {
      throw new Error('Invalid Signature');
    }
  }

  async get(name: string | CookieStoreGetOptions): Promise<CookieListItem | null> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');

    const cookie = await this.#store.get(name);
    if (!cookie) return null;

    const sigCookie = await this.#store.get(`${PREFIX}${name}`);
    if (!sigCookie) return null;

    await this.#verify(cookie, sigCookie);

    return cookie;
  }

  async getAll(name?: string | CookieStoreGetOptions): Promise<CookieList> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');

    const all = await this.#store.getAll(name);
    const cookies = all.filter(x => !x.name.startsWith(PREFIX));
    const sigCookies = new Map(all.filter(x => x.name.startsWith(PREFIX)).map(x => [x.name, x]));

    for (const cookie of cookies) {
      const sigCookie = sigCookies.get(`${PREFIX}${cookie.name}`);
      if (!sigCookie) continue;

      await this.#verify(cookie, sigCookie);
    }
    return cookies;
  }

  async set(options: string | CookieInit, value?: string) {
    const [name, val] = typeof options === 'string'
      ? [options, value]
      : [options.name, options.value ?? ''];

    if (name.startsWith(PREFIX)) throw new Error('Illegal name');

    const message = new TextEncoder().encode([name, val].join('='));
    const signature = await crypto.subtle.sign('HMAC', await this.#key, message);
    const b64Signature = new Base64Encoder({ url: true }).encode(signature);

    if (typeof options === 'string')  {
      this.#store.set(options, val);
      this.#store.set(`${PREFIX}${options}`, b64Signature);
    } else {
      const { name, value, ...init } = options;
      this.#store.set(options);
      this.#store.set({ 
        ...init, 
        name: `${PREFIX}${options.name}`, 
        value: b64Signature,
      });
    }

  }

  async delete(name: string | CookieStoreDeleteOptions): Promise<void> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');
     
    this.#store.delete(name);
    this.#store.delete(`${PREFIX}${name}`);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void { throw new Error("Method not implemented.") }
  dispatchEvent(event: Event): boolean { throw new Error("Method not implemented.") }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void { throw new Error("Method not implemented.") }
}

export * from "../fetch-cookie-store/cookie-store-interface"
