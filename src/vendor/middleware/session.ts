import { StorageArea } from '@werker/cloudflare-kv-storage';
import { UUID } from 'uuid-class';

import { BaseArg, Handler } from '.';
import { Awaitable } from '../common-types';
import { WithCookiesArgs } from './cookies';
import { shortenId, parseUUID } from '../short-id';

export type WithSessionDeps = BaseArg & WithCookiesArgs;
export type WithSessionArgs<S extends AnyRec = AnyRec> = { session: S };
export type WithSessionHandler<A extends WithSessionDeps, S> = (args: A & WithSessionArgs<S>) => Awaitable<Response>;

type AnyRec = Record<any, any>;

export interface SessionOptions {
  /** The storage area where to persist the session objects */
  storage?: StorageArea,

  /** You can override the name of the session cookie. Defaults to `sid`. */
  cookieName?: string,

  /** Session expiration time in seconds. Defaults to five minutes. */
  expirationTtl?: number,
}

/**
 * Session middleware for worker environments.
 * 
 * The session object is a POJO that is persisted once per microtask, i.e. setting multiple properties in a row (not yielding to the event loop) 
 * will only trigger a single serialization/database put operation. 
 * It will implicitly call `event.waitUntil` to prevent the worker to shut down before the operation has finished.
 * 
 * Users need to provide a `StorageArea` to persist the session between requests. 
 * There are implementations for both browsers (IndexedDB-backed) and Cloudflare Workers (KV storage backed) available.
 * 
 * Issues
 * - Will "block" until session object is retrieved from KV => provide "unyielding" version that returns a promise?
 */
export const withSession = <S extends AnyRec = AnyRec>({ storage, cookieName = 'sid', expirationTtl = 5 * 60 }: SessionOptions) =>
  <A extends WithSessionDeps>(handler: WithSessionHandler<A, S>): Handler<A> =>
    async (args: A): Promise<Response> => {
      const { cookies, cookieStore, event } = args;

      const sessionId = parseUUID(cookies.get(cookieName)) ?? new UUID();
      const session = await getSessionObject<S>(sessionId, event, { storage, cookieName, expirationTtl });

      const response = await handler({ ...args, session });

      await cookieStore.set({
        name: cookieName,
        value: shortenId(sessionId),
        sameSite: 'lax',
        httpOnly: true,
        expires: null, // session cookie
      });

      return response;
    };

async function getSessionObject<S extends AnyRec = AnyRec>(sessionId: UUID, event: FetchEvent, { storage, expirationTtl }: SessionOptions): Promise<S> {
  const obj = (await storage.get<S>(sessionId)) || <S>{};

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

  return new Proxy(<any>obj, {
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
