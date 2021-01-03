import { CookieInit, CookieListItem, CookieStore, CookieStoreGetOptions } from "@werker/request-cookie-store/interface";
import { UUID } from "uuid-class";
import { bufferSourceToUint8Array, concatBufferSources, splitBufferSource } from "typed-array-utils";
import { Base64Decoder, Base64Encoder } from "base64-encoding";
import { WithCookieOptions } from "../middleware";
import { SignedCookieStore } from "../signed-cookie-store";

const IV_LENGTH = 16; // bytes

const secretToUint8Array = (secret: string | BufferSource) => typeof secret === 'string'
  ? new TextEncoder().encode(secret)
  : bufferSourceToUint8Array(secret);

export class EncryptedCookieStore extends SignedCookieStore {
  /** A helper function to derive a crypto key from a passphrase */
  static async deriveCryptoKey(opts: WithCookieOptions): Promise<CryptoKey> {
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
        hash: opts.deriveHash ?? 'SHA-256',
        salt: opts.salt
          ? bufferSourceToUint8Array(opts.salt)
          : new UUID('19fc3989-ce6a-4b4e-b626-fa2e6ef3be0c')
      },
      passphraseKey,
      {
        name: 'AES-CBC',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    );

    return key;
  }

  #key: CryptoKey;

  constructor(store: CookieStore, signingKey: CryptoKey, encryptionKey: CryptoKey) {
    super(store, signingKey);
    this.#key = encryptionKey;
  }

  async set(options: string | CookieInit, value?: string) {
    const [name, val] = typeof options === 'string'
      ? [options, value]
      : [options.name, options.value ?? ''];

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const message = new TextEncoder().encode(val);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, this.#key, message);
    const cipherB64 = new Base64Encoder({ url: true }).encode(concatBufferSources(iv, cipher));
    return super.set({
      ...typeof options === 'string' ? {} : options,
      name,
      value: cipherB64,
    });
  }

  async get(name?: string | CookieStoreGetOptions): Promise<CookieListItem | null> {
    if (typeof name !== 'string') throw Error('Overload not implemented.');

    const cookie = await super.get(name);
    if (!cookie) return cookie;

    const buffer = new Base64Decoder().decode(cookie.value);
    const [iv, cipher] = splitBufferSource(buffer, IV_LENGTH);
    const clearBuffer = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, this.#key, cipher);
    const clearText = new TextDecoder().decode(clearBuffer);
    cookie.value = clearText;
    return cookie;
  }
}

export * from "@werker/request-cookie-store/interface";
