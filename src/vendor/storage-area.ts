export type Key = any;

declare var StorageArea: {
    prototype: StorageArea;
    new(name: string): StorageArea;
};

export interface StorageArea<BS = any> {
  set<T>(key: Key, value: T, opts?: Record<string, any>): Promise<void> ;
  get<T>(key: Key, opts?: Record<string, any>): Promise<T> ;
  delete(key: Key): Promise<void> ;
  clear(): Promise<void> ;

  keys(): AsyncIterableIterator<Key>;
  values<T>(): AsyncIterableIterator<T>;
  entries<T>(): AsyncIterableIterator<[Key, T]>;

  backingStore(): BS;
};

export function throwForDisallowedKey(key: any) {
  if (!isAllowedAsAKey(key)) {
    throw Error('kv-storage: The given value is not allowed as a key: ' + key);
  }
}

function isAllowedAsAKey(value: any) {
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
