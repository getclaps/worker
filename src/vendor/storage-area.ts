export type KVKey = number | string | Array<any> | Date | BufferSource

declare var StorageArea: {
    prototype: StorageArea;
    new(name: string): StorageArea;
};

export interface StorageArea {
  set(key: KVKey, value: any, opts?: { [k: string]: any }): Promise<void> ;
  get(key: KVKey, opts?: { [k: string]: any }): Promise<any> ;
  delete(key: KVKey): Promise<void> ;
  clear(): Promise<void> ;

  keys(): AsyncIterableIterator<KVKey>;
  values(): AsyncIterableIterator<any>;
  entries(): AsyncIterableIterator<[KVKey, any]>;

  backingStore(): any;
};

export function throwForDisallowedKey(key: KVKey) {
  if (!isAllowedAsAKey(key)) {
    throw Error('kv-storage: The given value is not allowed as a key');
  }
}

function isAllowedAsAKey(value: KVKey) {
  if (typeof value === 'number' || typeof value === 'string') {
    return true;
  }

  if (typeof value === 'object' && value) {
    if (Array.isArray(value)) {
      return true;
    }

    if ('setUTCFullYear' in value) {
      return true;
    }

    if (typeof ArrayBuffer === 'function' && ArrayBuffer.isView(value)) {
      return true;
    }

    // isArrayBuffer
    if ('byteLength' in value) {
      return true;
    }
  }

  return false;
}
