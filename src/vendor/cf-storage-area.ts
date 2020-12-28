import Typeson from 'typeson';
import structuredCloningThrowing from 'typeson-registry/dist/presets/structured-cloning-throwing';
import { encodeKey, decodeKey } from './cf-storage-area-keys';

import { Key, StorageArea, throwForDisallowedKey } from './storage-area';

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
const TSON = new Typeson().register(structuredCloningThrowing);

// TODO: options to use BSON or other binary rep instead of JSON.stringify...
const setValue = <T>(kv: KVNamespace, key: string, value: T, options?: CFSetOptions) =>
  kv.put(key, JSON.stringify(TSON.encapsulate(value)), options);

const getValue = async (kv: KVNamespace, key: string) =>
  TSON.revive(await kv.get(key, 'json'));

async function* paginationHelper(kv: KVNamespace) {
  let keys: { name: string; expiration?: number; metadata?: unknown }[];
  let done: boolean;
  let cursor: string;
  do {
    ({ keys, list_complete: done, cursor } = await kv.list({ ...cursor ? { cursor } : {} }));
    for (const { name } of keys) yield name;
  } while (!done);
}

export interface CFSetOptions {
  expiration?: string | number;
  expirationTtl?: string | number;
}

export class CFStorageArea implements StorageArea<KVNamespace> {
  #kv: KVNamespace;

  constructor(name: string | KVNamespace) {
    this.#kv = (typeof name === 'string')
      ? Reflect.get(self, name)
      : name;
    if (!this.#kv) throw Error('KV binding missing. Consult CF Workers documentation for details')
  }

  async get<T>(key: Key): Promise<T> {
    throwForDisallowedKey(key);
    return getValue(this.#kv, encodeKey(key));
  }

  async set<T>(key: Key, value: T | undefined, options?: CFSetOptions): Promise<void> {
    if (value === undefined) await this.#kv.delete(encodeKey(key));
    else {
      throwForDisallowedKey(key);
      await setValue(this.#kv, encodeKey(key), value, options);
    }
  }

  async delete(key: Key) {
    throwForDisallowedKey(key);
    return this.#kv.delete(encodeKey(key));
  }

  async clear() {
    for await (const key of paginationHelper(this.#kv)) {
      await this.#kv.delete(key)
    }
  }

  async *keys<K extends Key = Key>(): AsyncGenerator<K> {
    for await (const key of paginationHelper(this.#kv)) {
      yield decodeKey(key);
    }
  }

  async *values<T>(): AsyncGenerator<T> {
    for await (const key of paginationHelper(this.#kv)) {
      yield getValue(this.#kv, key);
    }
  }

  async *entries<T, K extends Key = Key>(): AsyncGenerator<[K, T]> {
    for await (const key of paginationHelper(this.#kv)) {
      yield [decodeKey(key), await getValue(this.#kv, key)];
    }
  }

  backingStore() {
    return this.#kv;
  }
}
