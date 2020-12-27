import Typeson from 'typeson';
import structuredCloningThrowing from 'typeson-registry/dist/presets/structured-cloning-throwing';

import { StorageAreaKey, StorageArea, throwForDisallowedKey } from './storage-area';

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
const TSON = new Typeson().register(structuredCloningThrowing);

const encodeKey = (key: StorageAreaKey) => JSON.stringify(TSON.encapsulate(key));
const decodeKey = (key: string) => TSON.revive(JSON.parse(key));

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

  async get<T>(key: StorageAreaKey): Promise<T> {
    throwForDisallowedKey(key);
    return getValue(this.#kv, encodeKey(key));
  }

  async set<T>(key: StorageAreaKey, value: T, options?: CFSetOptions): Promise<void> {
    throwForDisallowedKey(key);
    await setValue(this.#kv, encodeKey(key), value, options);
  }

  async delete(key: StorageAreaKey) {
    throwForDisallowedKey(key);
    return this.#kv.delete(encodeKey(key));
  }

  async clear() {
    for await (const key of paginationHelper(this.#kv)) {
      await this.#kv.delete(key)
    }
  }

  async *keys<K extends StorageAreaKey = StorageAreaKey>(): AsyncGenerator<K> {
    for await (const key of paginationHelper(this.#kv)) {
      yield decodeKey(key);
    }
  }

  async *values<T>(): AsyncGenerator<T> {
    for await (const key of paginationHelper(this.#kv)) {
      yield getValue(this.#kv, key);
    }
  }

  async *entries<T, K extends StorageAreaKey = StorageAreaKey>(): AsyncGenerator<[K, T]> {
    for await (const key of paginationHelper(this.#kv)) {
      yield [decodeKey(key), await getValue(this.#kv, key)];
    }
  }

  backingStore() {
    return this.#kv;
  }

}
