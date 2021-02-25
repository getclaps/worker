import { CookieInit, CookieList, CookieListItem, CookieStore, CookieStoreDeleteOptions, CookieStoreGetOptions } from "@worker-tools/request-cookie-store/interface";
import { UUID } from "uuid-class";
import { bufferSourceToUint8Array } from "typed-array-utils";
import { Base64Decoder, Base64Encoder } from "base64-encoding";

const EXT = '.sig';

const secretToUint8Array = (secret: string | BufferSource) => typeof secret === 'string'
  ? new TextEncoder().encode(secret)
  : bufferSourceToUint8Array(secret);

export interface DeriveOptions {
  secret: string | BufferSource,
  salt?: BufferSource,
  iterations?: number,
}

/**
 * # Signed Cookie Store
 * A partial implementation of the [Cookie Store API](https://wicg.github.io/cookie-store)
 * that transparently signs and verifies cookies via the Web Cryptography API. 
 * 
 * This is likely only useful in server-side implementations, 
 * but written in a platform-agnostic way. 
 */
export class SignedCookieStore implements CookieStore {
  /** 
   * A helper function to derive a crypto key from a passphrase. 
   */
  static async deriveCryptoKey(opts: DeriveOptions): Promise<CryptoKey> {
    if (!opts.secret) throw Error('Secret missing');

    const passphraseKey = await crypto.subtle.importKey(
      'raw',
      secretToUint8Array(opts.secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        iterations: opts.iterations ?? 999,
        hash: 'SHA-256',
        salt: opts.salt
          ? bufferSourceToUint8Array(opts.salt)
          : new UUID('a3491c45-b769-447f-87fd-64333c8d36f0')
      },
      passphraseKey,
      {
        name: 'HMAC',
        hash: 'SHA-256',
        length: 128
      },
      false,
      ['sign', 'verify'],
    );

    return key
  }

  #store: CookieStore;
  #key: CryptoKey;

  constructor(store: CookieStore, key: CryptoKey) {
    this.#store = store;
    this.#key = key;
  }

  #verify = async (cookie: CookieListItem, sigCookie: CookieListItem) => {
    const signature = new Base64Decoder().decode(sigCookie.value);
    const message = new TextEncoder().encode([cookie.name, cookie.value].join('='));
    const ok = await crypto.subtle.verify('HMAC', this.#key, signature, message);
    if (!ok) throw new Error('Invalid Signature');
  }

  #sign = async (name: string, value: string): Promise<string> => {
    const message = new TextEncoder().encode([name, value].join('='));
    const signature = await crypto.subtle.sign('HMAC', this.#key, message);
    return new Base64Encoder({ url: true }).encode(signature);
  }

  /**
   * @throws if the signature doesn't match.
   * @returns null when the signature cookie is missing. 
   */
  get(name?: string): Promise<CookieListItem | null>;
  get(options?: CookieStoreGetOptions): Promise<CookieListItem | null>;
  async get(name?: string | CookieStoreGetOptions): Promise<CookieListItem | null> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');

    const cookie = await this.#store.get(name);
    if (!cookie) return null;

    const sigCookie = await this.#store.get(`${name}${EXT}`);
    if (!sigCookie) return null;

    await this.#verify(cookie, sigCookie);

    return cookie;
  }

  /**
   * @throws if any signature doesn't match.
   * @returns A list of cookies, exclusive of all cookies without signatures
   */
  getAll(name?: string): Promise<CookieList>;
  getAll(options?: CookieStoreGetOptions): Promise<CookieList>;
  async getAll(name?: string | CookieStoreGetOptions): Promise<CookieList> {
    if (name != null) throw Error('Overload not implemented.');

    const all = await this.#store.getAll();
    const sigCookies = all.filter(x => x.name.endsWith(EXT))

    const list: CookieList = [];

    for (const sigCookie of sigCookies) {
      const name = sigCookie.name;
      const baseCookieName = name.substring(0, name.length - EXT.length);
      const cookie = await this.get(baseCookieName);
      if (cookie) list.push(cookie);
    }

    return list;
  }

  set(name: string, value: string): Promise<void>;
  set(options: CookieInit): Promise<void>;
  async set(options: string | CookieInit, value?: string) {
    const [name, val] = typeof options === 'string'
      ? [options, value ?? '']
      : [options.name, options.value ?? ''];

    if (name.endsWith(EXT)) throw new Error('Illegal name');

    const signature = await this.#sign(name, val);
    const sigCookieName = `${name}${EXT}`;

    if (typeof options === 'string') {
      await Promise.all([
        this.#store.set(options, val),
        this.#store.set(sigCookieName, signature),
      ]);
    } else {
      const { name, value, ...init } = options;
      await Promise.all([
        this.#store.set(options),
        this.#store.set({ ...init, name: sigCookieName, value: signature }),
      ]);
    }
  }

  delete(name: string): Promise<void>;
  delete(options: CookieStoreDeleteOptions): Promise<void>;
  async delete(name: string | CookieStoreDeleteOptions): Promise<void> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');

    await Promise.all([
      this.#store.delete(name),
      this.#store.delete(`${name}${EXT}`),
    ]);
  }

  addEventListener(...args: Parameters<CookieStore['addEventListener']>): void {
    return this.#store.addEventListener(...args);
  }
  dispatchEvent(event: Event): boolean {
    return this.#store.dispatchEvent(event);
  }
  removeEventListener(...args: Parameters<CookieStore['removeEventListener']>): void {
    return this.#store.removeEventListener(...args);
  }
}

export * from "@worker-tools/request-cookie-store/interface";
