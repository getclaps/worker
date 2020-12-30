export type Key = string | number | Date | BufferSource | Key[];

declare var StorageArea: {
    prototype: StorageArea;
    new(name: string): StorageArea;
};

type Options = Record<string, any>;

/**
 * Main differences to the working draft:
 * - Type parameter for the backing store.
 * - Added unspecified options paramter to all methods. Implementations can 
 *   It's unlikely that the working draft will add parameters to the methods, and if they do your keys might not interfere.
 */
export interface StorageArea<BS = any> {
  set<T>(key: Key, value: T, opts?: Options): Promise<void> ;
  get<T>(key: Key, opts?: Options): Promise<T> ;
  delete(key: Key, opts?: Options): Promise<void> ;
  clear(opts?: Options): Promise<void> ;

  keys(opts?: Options): AsyncIterableIterator<Key>;
  values<T>(opts?: Options): AsyncIterableIterator<T>;
  entries<T>(opts?: Options): AsyncIterableIterator<[Key, T]>;

  backingStore(): BS;
};
