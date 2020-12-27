import { Repeatable } from "./common-types";

export type StorageAreaKey = Repeatable<number | string | Date | BufferSource>

declare var StorageArea: {
    prototype: StorageArea;
    new(name: string): StorageArea;
};

export interface StorageArea {
  set(key: StorageAreaKey, value: any, opts?: Record<string, any>): Promise<void> ;
  get(key: StorageAreaKey, opts?: Record<string, any>): Promise<any> ;
  delete(key: StorageAreaKey): Promise<void> ;
  clear(): Promise<void> ;

  keys(): AsyncIterableIterator<StorageAreaKey>;
  values(): AsyncIterableIterator<any>;
  entries(): AsyncIterableIterator<[StorageAreaKey, any]>;

  backingStore(): any;
};

export function throwForDisallowedKey(key: StorageAreaKey) {
  if (!isAllowedAsAKey(key)) {
    throw Error('kv-storage: The given value is not allowed as a key');
  }
}

function isAllowedAsAKey(value: StorageAreaKey) {
  if (typeof value === 'number' || typeof value === 'string') {
    return true;
  }

  if (typeof value === 'object' && value) {
    if (Array.isArray(value)) {
      return true;
    }

    if (value instanceof Date) {
      return true;
    }

    if (ArrayBuffer.isView(value)) {
      return true;
    }

    if (value instanceof ArrayBuffer) {
      return true;
    }
  }

  return false;
}
