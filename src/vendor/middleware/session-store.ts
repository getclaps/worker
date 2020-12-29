import { UUID } from 'uuid-class';
import { Awaitable } from '../common-types';

import { shortenId, parseUUID } from '../short-id';
import { StorageArea } from '../storage-area';

import { CookieStore, SyncCookieStore } from './cookie-store-types';

type Args = { event: FetchEvent, cookies: CookieStore | SyncCookieStore };
type WithSessionHandler<T, S> = (args: T & { session: Promise<S> }) => Awaitable<Response>;

interface SessionOptions {
  storage?: StorageArea,
  cookieName?: string,
  expirationTtl?: number,
}

type HasId = { id: UUID };
type DefaultSession = { id: UUID, [k: string]: any };

async function getSessionObject<S extends HasId = DefaultSession>(sessionId: UUID, event: FetchEvent, { storage, cookieName, expirationTtl }: SessionOptions): Promise<S> {
  const obj = (await storage.get<S>(sessionId)) || <S>{ id: sessionId };

  let nr = 0;
  /** Batch calls within the same micro task */
  const persist = () => {
    const capturedNr = ++nr;
    event.waitUntil((async () => {
      await new Promise(r => setTimeout(r)); // await end of microtask
      if (capturedNr === nr) { // no other invocations since
        await storage.set(sessionId, obj, { expirationTtl });
      }
    })());
  }

  return new Proxy(obj, {
    set(target, prop, value) {
      target[prop] = value;
      persist();
      return true;
    },

    deleteProperty(target, prop) {
      delete target[prop];
      persist();
      return true;
    }
  });
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
export const withSession = <S extends HasId = DefaultSession>({ storage, cookieName = 'sid', expirationTtl = 5 * 60 }: SessionOptions) =>
  <T extends Args>(handler: WithSessionHandler<T, S>) =>
    async (args: T): Promise<Response> => {
      const { cookies, event } = args;
      const sessionId = parseUUID((await cookies.get(cookieName))?.value) ?? new UUID();
      const session = getSessionObject<S>(sessionId, event, { storage, cookieName, expirationTtl });
      const response = await handler({ ...args, session });
      cookies.set({
        name: cookieName,
        value: shortenId(sessionId),
        sameSite: 'lax',
        httpOnly: true,
        expires: null, // session cookie
      });
      return response;
    };
