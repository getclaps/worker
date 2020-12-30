import { StorageArea } from '@werker/cloudflare-kv-storage';
import { UUID } from 'uuid-class';

import { BaseArg, Handler } from '.';
import { Awaitable } from '../common-types';
import { WithCookiesArgs } from './cookie-store';
import { shortenId, parseUUID } from '../short-id';

export type WithSessionDeps = BaseArg & WithCookiesArgs;
export type WithSessionArgs<S> = { session: S };
export type WithSessionHandler<A extends WithSessionDeps, S> = (args: A & WithSessionArgs<S>) => Awaitable<Response>;

type AnyRec = Record<any, any>;

export interface SessionOptions {
  storage?: StorageArea,

  /** You can override the name of the session cookie. Defaults to `sid`. */
  cookieName?: string,

  /** Session expiration time in seconds. Defaults to five minutes. */
  expirationTtl?: number,
}

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


/**
 * Session middleware for worker environments.
 * 
 * Users need to provide a `StorageArea` to persist the session between requests. 
 * There are implementations for both browsers (IndexedDB-backed) and Cloudflare Workers (KV storage backed) available.
 * 
 * The session object is a POJO that is persistend once per microtask, i.e. setting multiple properties in a row (i.e. not yielding to the event loop) 
 * will only trigger a single serialization + database put operation. 
 * It will implicitly call `event.waitUntil` to prevent the worker to shut down before the operation has finished.
 */
export const withSession = <S extends AnyRec = AnyRec>({ storage, cookieName = 'sid', expirationTtl = 5 * 60 }: SessionOptions) =>
  <A extends WithSessionDeps>(handler: WithSessionHandler<A, S>): Handler<A> =>
    async (args: A): Promise<Response> => {
      const { cookies, cookieStore, event } = args;
      const sessionId = parseUUID(cookies.get(cookieName)) ?? new UUID();
      const session = await getSessionObject<S>(sessionId, event, { storage, cookieName, expirationTtl });

      const response = await handler({ ...args, session });

      cookieStore.set({
        name: cookieName,
        value: shortenId(sessionId),
        sameSite: 'lax',
        httpOnly: true,
        expires: null, // session cookie
      });

      return response;
    };

// TODO: Non-yielding (unyielding?) variant
// The session object is provided as a promise, so that users have full control over when to await for the database request to finish.
// (when serving streaming responses via @werker/html you might not want to wait for a db request to finish before sending initial response data)
