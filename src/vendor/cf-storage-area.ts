import Typeson from 'typeson';
import structuredCloningThrowing from 'typeson-registry/dist/presets/structured-cloning-throwing';

import { KVKey, StorageArea, throwForDisallowedKey } from './storage-area';

// http://stackoverflow.com/a/33268326/786644 - works in browser, worker, and Node.js
const TSON = new Typeson().register(structuredCloningThrowing);

const encodeKey = (key: KVKey) => JSON.stringify(TSON.encapsulate(key));
const decodeKey = (key: string) => TSON.revive(JSON.parse(key));

const setValue = (kv: KVNamespace, key: string, value: any, options?: KVSetOptions) =>
  kv.put(key, JSON.stringify(TSON.encapsulate(value)), options);

const getValue = async (kv: KVNamespace, key: string) =>
  TSON.revive(await kv.get(key, 'json'));

async function* paginationHelper(db: KVNamespace) {
  let keys: { name: string; expiration?: number; metadata?: unknown }[];
  let done: boolean;
  let cursor: string;
  do {
    ({ keys, list_complete: done, cursor } = await db.list({ ...cursor ? { cursor } : {} }));
    for (const { name } of keys) yield name;
  } while (!done);
}

export interface KVSetOptions {
  expiration?: string | number;
  expirationTtl?: string | number;
}

export class CFStorageArea implements StorageArea {
  #kv: KVNamespace;

  constructor(name: string | KVNamespace) {
    this.#kv = (typeof name === 'string')
      ? Reflect.get(self, name)
      : name;
    if (!this.#kv) throw Error('KV binding missing. Consult CF Workers documentation for details')
  }

  async get(key: KVKey): Promise<any> {
    throwForDisallowedKey(key);
    return getValue(this.#kv, encodeKey(key));
  }

  async set(key: KVKey, value: any, options?: KVSetOptions): Promise<void> {
    throwForDisallowedKey(key);
    await setValue(this.#kv, encodeKey(key), value, options);
  }

  async delete(key: KVKey) {
    throwForDisallowedKey(key);
    return this.#kv.delete(encodeKey(key));
  }

  async clear() {
    for await (const key of paginationHelper(this.#kv)) {
      await this.#kv.delete(key)
    }
  }

  async *keys(): AsyncGenerator<KVKey> {
    for await (const key of paginationHelper(this.#kv)) {
      yield decodeKey(key);
    }
  }

  async *values(): AsyncGenerator<any> {
    for await (const key of paginationHelper(this.#kv)) {
      yield getValue(this.#kv, key);
    }
  }

  async *entries(): AsyncGenerator<[KVKey, any]> {
    for await (const key of paginationHelper(this.#kv)) {
      yield [decodeKey(key), await getValue(this.#kv, key)];
    }
  }

  backingStore() {
    return this.#kv;
  }

}
