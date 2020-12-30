import { UUID } from "uuid-class";
import { bufferSourceToUint8Array } from "typed-array-utils";
import { Base64Decoder, Base64Encoder } from "base64-encoding";

import { CookieInit, CookieList, CookieListItem, CookieStore } from "./cookie-store-types";

const PREFIX = '~s.';
// const POSTFIX = '';

export class SignedCookieStore implements CookieStore {
  static async create(store: CookieStore, { secret }: { secret: string | BufferSource }) {
    const secretBuffer = typeof secret === 'string'
      ? new TextEncoder().encode(secret)
      : bufferSourceToUint8Array(secret);

    const passphraseKey = await crypto.subtle.importKey('raw', secretBuffer, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        iterations: 1000,
        hash: 'SHA-256',
        salt: new UUID('a3491c45-b769-447f-87fd-64333c8d36f0'), // TODO: make configurable
      },
      passphraseKey,
      { name: 'HMAC', hash: 'SHA-256', length: 128 },
      true,
      ['sign', 'verify'],
    );

    return new SignedCookieStore(store, key);
  }

  backingStore() {
    return this.#store;
  }

  #store: CookieStore;
  #key: CryptoKey
  constructor(store: CookieStore, key: CryptoKey) {
    this.#store = store;
    this.#key = key;
  }

  private async verify(cookie: CookieListItem, sigCookie: CookieListItem) {
    const signature = new Base64Decoder().decode(sigCookie.value);
    const message = new TextEncoder().encode([cookie.name, cookie.value].join('='));
    const ok = await crypto.subtle.verify('HMAC', this.#key, signature, message);
    if (!ok) {
      throw new Error('Invalid Signature');
    }
  }

  async get(name?: string): Promise<CookieListItem> {
    const cookie = await this.#store.get(name);
    if (!cookie) return cookie;

    const sigCookie = await this.#store.get(`${PREFIX}${name}`);
    if (!sigCookie) throw new Error('Signature cookie missing');

    this.verify(cookie, sigCookie);

    return cookie;
  }

  async getAll(name?: string): Promise<CookieList> {
    const all = await this.#store.getAll(name);
    const cookies = all.filter(x => !x.name.startsWith(PREFIX));
    const sigCookies = new Map(all.filter(x => x.name.startsWith(PREFIX)).map(x => [x.name, x]));

    for (const cookie of cookies) {
      const sigCookie = sigCookies.get(`${PREFIX}${cookie.name}`);
      if (!sigCookie) throw new Error('Signature cookie missing');

      this.verify(cookie, sigCookie);
    }
    return cookies;
  }

  set(name: string, value: string): Promise<void>;
  set(options: CookieInit): Promise<void>;
  async set(options: string | CookieInit, value?: string) {
    const [name, val] = typeof options === 'string'
      ? [options, value]
      : [options.name, options.value ?? ''];

    const message = new TextEncoder().encode([name, val].join('='));
    const signature = await crypto.subtle.sign('HMAC', this.#key, message);
    const sig = new Base64Encoder({ url: true }).encode(signature);

    if (typeof options === 'string')  {
      this.#store.set(options, val);
      this.#store.set(`${PREFIX}${options}`, sig);
    } else {
      const { name, value, ...init } = options;
      this.#store.set(options);
      this.#store.set({ 
        ...init, 
        name: `${PREFIX}${options.name}`, 
        value: sig,
      });
    }

  }

  async delete(name: string): Promise<void> {
    this.#store.delete(name);
    this.#store.delete(`${PREFIX}${name}`);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void { throw new Error("Method not implemented.") }
  dispatchEvent(event: Event): boolean { throw new Error("Method not implemented.") }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void { throw new Error("Method not implemented.") }
}

