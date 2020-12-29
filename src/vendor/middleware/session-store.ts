import { UUID } from 'uuid-class';
import { Awaitable } from '../common-types';

import { shortenId, parseUUID } from '../short-id';
import { StorageArea } from '../storage-area';

import { CookieStore, SyncCookieStore } from './cookie-store-types';

type Args = { event: FetchEvent, cookies: CookieStore | SyncCookieStore };
type WithSessionHandler<T> = (args: T & { session: Promise<SessionStore> }) => Awaitable<Response>;

interface SessionOptions {
  storage?: StorageArea,
  sessionKey?: string,
  expirationTtl?: number,
}

const symbols = {
  create: Symbol('Session.create'),
}

export class SessionStore {
  #map: Map<string, any>;
  #id: UUID;
  #event: FetchEvent;
  #storage: StorageArea;
  #opts: Record<string, any>;

  static async [symbols.create]({ event, cookies }: Args, { storage, sessionKey, expirationTtl }: SessionOptions) {
    let sid = parseUUID((await cookies.get(sessionKey))?.value);
    const map = sid && await storage.get<Map<string, any>>(sid);
    sid = map ? sid : new UUID();
    return new SessionStore(symbols.create, map ?? new Map(), sid, { event, cookies }, { storage, expirationTtl });
  }

  private constructor(caller: symbol, map: Map<string, any>, id: UUID, { event }: Args, { storage, expirationTtl }: SessionOptions) {
    if (caller !== symbols.create) throw Error('Illegal constructor');
    this.#map = map;
    this.#id = id;
    this.#event = event;
    this.#storage = storage;
    this.#opts = { expirationTtl };
  }

  get id() {
    return this.#id;
  }

  #nr = 0;
  /** Batch calls within the same micro task */
  #persist = () => {
    const capturedNr = ++this.#nr;
    this.#event.waitUntil((async () => {
      await new Promise(r => setTimeout(r)); // await end of microtask
      if (capturedNr === this.#nr) { // no other invocations since
        await this.#storage.set(this.#id, this.#map, this.#opts);
      } 
    })());
  }

  set<T>(key: string, value: T): this {
    this.#map.set(key, value);
    this.#persist();
    return this;
  }

  delete(key: string): boolean {
    const ret = this.#map.delete(key);
    this.#persist();
    return ret;
  }

  clear(): void {
    this.#map.clear();
    this.#persist();
  }

  // Pass-along implementations...
  get<T>(key: string): T {
    return this.#map.get(key);
  }
  has(key: string): boolean {
    return this.#map.has(key);
  }
  get size() { return this.#map.size }
  [Symbol.iterator]<T>(): IterableIterator<[string, T]> {
    return this.#map[Symbol.iterator]();
  }
  entries<T>(): IterableIterator<[string, T]> {
    return this.#map.entries();
  }
  keys(): IterableIterator<string> {
    return this.#map.keys();
  }
  values<T>(): IterableIterator<T> {
    return this.#map.values();
  }
}

/**
 * Session middleware for worker environments.
 * 
 * Users need to provide a `StorageArea` to persist the session between requests. 
 * There are implementations for both browsers (IndexedDB-backed) and Cloudflare Workers (KV storage backed) available.
 * 
 * The session object is provided as a promise, so that users have full control over when to await for the database request to finish.
 * (when serving streaming responses via @werker/html you might not want to wait for a db request to finish before sending initial response data)
 */
export const withSession = ({ storage, sessionKey = 'sid', expirationTtl = 5 * 60 }: SessionOptions) => 
  <T extends Args>(handler: WithSessionHandler<T>) => 
    async (args: T): Promise<Response> => {
      const session = SessionStore[symbols.create](args, { storage, sessionKey, expirationTtl });
      const response = await handler({ ...args, session });
      args.cookies.set({
        name: sessionKey,
        value: shortenId(session.id),
        sameSite: 'lax',
        httpOnly: true,
        expires: null, // session cookie
      });
      return response;
    };
