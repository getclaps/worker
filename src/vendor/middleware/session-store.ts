import { UUID } from 'uuid-class';
import { CFStorageArea } from '../cf-storage-area';
import { Awaitable } from '../common-types';

import { shortenId, parseUUID } from '../short-id';
import { KVKey, StorageArea } from '../storage-area';

import { CookieStore } from './cookie-store';

type Args = { event: FetchEvent, cookies: CookieStore };
type WithSessionHandler<T> = (args: T & { session: SessionStore }) => Awaitable<Response>

interface SessionOptions {
  storage: StorageArea,
  kv?: KVNamespace,
  sessionKey?: string,
  expirationTtl?: number,
}

// const coerceJSON = (v: JSONValue) => JSON.parse(JSON.stringify(v));

const symbols = {
  create: Symbol('Session.create'),
}

export class SessionStore {
  id: UUID

  private prefix: string;
  private storage: StorageArea;
  private expirationTtl: number;

  static async [symbols.create]({ cookies }: Args, { storage, sessionKey, expirationTtl }: SessionOptions) {
    const sid = parseUUID((await cookies.get(sessionKey))?.value) ?? new UUID();
    return new SessionStore(symbols.create, sid, { storage, expirationTtl });
  }

  private constructor(caller: symbol, id: UUID, { storage, expirationTtl }: SessionOptions) {
    if (caller !== symbols.create) throw Error('Illegal constructor');
    this.id = id;
    this.prefix = shortenId(id);
    this.storage = storage;
    this.expirationTtl = expirationTtl;
  }

  get(key: string): Promise<any> {
    return this.storage.get(`${this.prefix}/${key}`);
  }

  set(key: string, value: any): Promise<void> {
    return this.storage.set(`${this.prefix}/${key}`, value, { expirationTtl: this.expirationTtl });
  }

  // delete(key: string): Promise<void> {
  //   throw new Error('Method not implemented.');
  // }

  // clear(): Promise<void> {
  //   throw new Error('Method not implemented.');
  // }

  // keys(): AsyncIterableIterator<KVKey> {
  //   throw new Error('Method not implemented.');
  // }

  // values(): AsyncIterableIterator<any> {
  //   throw new Error('Method not implemented.');
  // }

  // entries(): AsyncIterableIterator<[KVKey, any]> {
  //   throw new Error('Method not implemented.');
  // }

  // backingStore() {
  //   return this.storage;
  // }
}

export const withSession = ({ storage, kv, sessionKey = 'sid', expirationTtl = 5 * 60 }: SessionOptions) => 
  <T extends Args>(handler: WithSessionHandler<T>) => 
    async (args: T): Promise<Response> => {
      if (!storage && kv) storage = new CFStorageArea(kv)
      const session = await SessionStore[symbols.create](args, { storage, sessionKey, expirationTtl });
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
