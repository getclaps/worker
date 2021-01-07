import { CookieInit, CookieList, CookieListItem, CookieStore, CookieStoreDeleteOptions, CookieStoreGetOptions } from "@werker/request-cookie-store/interface";
import { UUID } from "uuid-class";
import { bufferSourceToUint8Array, concatBufferSources, splitBufferSource } from "typed-array-utils";
import { Base64Decoder, Base64Encoder } from "base64-encoding";

const POSTFIX = '.enc';
const IV_LENGTH = 16; // bytes

const secretToUint8Array = (secret: string | BufferSource) => typeof secret === 'string'
  ? new TextEncoder().encode(secret)
  : bufferSourceToUint8Array(secret);

export interface DeriveOptions {
  secret: string | BufferSource,
  salt?: BufferSource,
  iterations?: number,
}

/**
 * # Encrypted Cookie Store
 * An implementation of the [Cookie Store API](https://wicg.github.io/cookie-store)
 * that transparently encrypts and decrypts cookie via AES-GCM.
 */
export class EncryptedCookieStore implements CookieStore {
  /** A helper function to derive a crypto key from a passphrase */
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
          : new UUID('19fc3989-ce6a-4b4e-b626-fa2e6ef3be0c')
      },
      passphraseKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    );

    return key;
  }

  #store: CookieStore;
  #key: CryptoKey;

  constructor(store: CookieStore, encryptionKey: CryptoKey) {
    this.#store = store;
    this.#key = encryptionKey;
  }

  get(name?: string): Promise<CookieListItem | null>;
  get(options?: CookieStoreGetOptions): Promise<CookieListItem | null>;
  async get(name?: string | CookieStoreGetOptions): Promise<CookieListItem | null> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');

    const cookie = await this.#store.get(`${name}${POSTFIX}`);
    if (!cookie) return cookie;

    return this.#decrypt(cookie);
  }

  getAll(name?: string): Promise<CookieList>;
  getAll(options?: CookieStoreGetOptions): Promise<CookieList>;
  async getAll(options?: any) {
    if (options != null) throw Error('Overload not implemented.');

    const list: CookieList = [];
    for (const cookie of await this.#store.getAll(options)) {
      if (cookie.name.endsWith(POSTFIX)) {
        list.push(await this.#decrypt(cookie));
      }
    }
    return list;
  }

  set(name: string, value: string): Promise<void>;
  set(options: CookieInit): Promise<void>;
  async set(options: string | CookieInit, value?: string) {
    const [name, val] = typeof options === 'string'
      ? [options, value]
      : [options.name, options.value ?? ''];

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const message = new TextEncoder().encode(val);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.#key, message);
    const cipherB64 = new Base64Encoder({ url: true }).encode(concatBufferSources(iv, cipher));
    return this.#store.set({
      ...typeof options === 'string' ? {} : options,
      name: `${name}${POSTFIX}`,
      value: cipherB64,
    });
  }

  delete(name: string): Promise<void>;
  delete(options: CookieStoreDeleteOptions): Promise<void>;
  delete(options: any) {
    if (typeof options !== 'string') throw Error('Overload not implemented.');
    return this.#store.delete(`${options}${POSTFIX}`);
  }

  #decrypt = async (cookie: CookieListItem): Promise<CookieListItem> =>  {
    const buffer = new Base64Decoder().decode(cookie.value);
    const [iv, cipher] = splitBufferSource(buffer, IV_LENGTH);
    const clearBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.#key, cipher);
    const clearText = new TextDecoder().decode(clearBuffer);
    cookie.name = cookie.name.substring(0, cookie.name.length - POSTFIX.length);
    cookie.value = clearText;
    return cookie;
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

export * from "@werker/request-cookie-store/interface";
