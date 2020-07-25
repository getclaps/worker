import { Base64Encoder, Base64Decoder } from 'base64-encoding';

const PREFIX = 'data:application/octet-stream;base64,';

// const b64e = new Base64Encoder();
// const b64d = new Base64Decoder();

export class StorageArea {
  /**
   * @param {string} name 
   */
  constructor(name) {
    this.db = Reflect.get(self, name)
  }

  /**
   * @param {string|ArrayBuffer} key 
   */
  async get(key) {
    if (key instanceof ArrayBuffer) { key = PREFIX + new Base64Encoder().encode(key) }
    return this.db.get(key)
  }

  /**
   * @param {string|ArrayBuffer} key 
   * @param {any} value 
   */
  async set(key, value) {
    if (key instanceof ArrayBuffer) { key = PREFIX + new Base64Encoder().encode(key) }
    this.db.put(key, value)
  }

  /**
   * @param {string|ArrayBuffer} key 
   * @param {any} value 
   */
  async delete(key, value) {
    if (key instanceof ArrayBuffer) { key = PREFIX + new Base64Encoder().encode(key) }
    return this.db.delete(key, value)
  }

  async *__paginationHelper() {
    let keys, done, cursor;
    do {
      ({ keys, list_complete: done, cursor } = await this.db.list({ ...cursor ? { cursor } : {} }));
      console.log(keys, done, cursor);
      for (const { name: key } of keys) yield key;
    } while (!done);
  }

  async clear() {
    for await (const key of this.__paginationHelper()) {
      await this.db.delete(key)
    }
  }

  /**
   * @returns {AsyncGenerator<string|ArrayBuffer>}
   */
  async *keys() {
    for await (let key of this.__paginationHelper()) {
      if (key.startsWith(PREFIX)) { key = new Base64Decoder().decode(key.substr(PREFIX.length)) }
      yield key;
    }
  } 

  /**
   * @returns {AsyncGenerator<any>}
   */
  async *values() {
    for await (let key of this.__paginationHelper()) {
      yield this.db.get(key);
    }
  } 

  /**
   * @returns {AsyncGenerator<[string|ArrayBuffer, any]>}
   */
  async *entries() {
    for (let key of await this.db.list()) {
      yield [
        key.startsWith(PREFIX) 
          ? new Base64Decoder().decode(key.substr(PREFIX.length)) 
          : key,
        await this.db.get(key)
      ];
    }
  } 
}
