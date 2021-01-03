import 'abortcontroller-polyfill';

import { StorageArea } from '@werker/cloudflare-kv-storage/interface';
import { UUID } from 'uuid-class';
import { Base64Decoder, Base64Encoder } from 'base64-encoding';
import { Encoder as MsgPackEncoder, Decoder as MsgPackDecoder } from 'msgpackr/browser';
// import { Encoder as CBOREncoder, Decoder as CBORDecoder } from 'cbor-x/browser';

import { BaseArg, Handler } from '.';
import { Awaitable } from '../common-types';
import { WithCookiesArgs } from './cookies';
import { shortenId, parseUUID } from '../short-id';

type AnyRec = Record<any, any>;

export type WithSessionDeps = BaseArg & WithCookiesArgs;
export type WithSessionArgs<S extends AnyRec = AnyRec> = { session: S };
export type WithSessionHandler<A extends WithSessionDeps, S> = (args: A & WithSessionArgs<S>) => Awaitable<Response>;

// TODO: make configurable
// const stringifySessionCookie = <T>(value: T) => new Base64Encoder({ url: true }).encode(new CBOREncoder({ structuredClone: true }).encode(value));
// const parseSessionCookie = <T>(value: string) => <T>new CBORDecoder({ structuredClone: true }).decode(new Base64Decoder().decode(value));
const stringifySessionCookie = <T>(value: T) => new Base64Encoder({ url: true }).encode(new MsgPackEncoder({ structuredClone: true }).encode(value));
const parseSessionCookie = <T>(value: string) => <T>new MsgPackDecoder({ structuredClone: true }).decode(new Base64Decoder().decode(value));

export interface SessionOptions<S extends AnyRec = AnyRec> {
  /** 
   * The storage area where to persist the session objects. 
   * If it is omitted, the session will be a pure cookie session.
   */
  storage?: StorageArea,

  /** You can override the name of the session cookie. Defaults to `sid`. */
  cookieName?: string,

  /** Session expiration time in seconds. Defaults to five minutes. */
  expirationTtl?: number,

  /** TODO */
  defaultSession?: S,
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
export const withSession = <S extends AnyRec = AnyRec>({ storage, defaultSession = {}, cookieName = 'sid', expirationTtl = 5 * 60 }: SessionOptions = {}) =>
  <A extends WithSessionDeps>(handler: WithSessionHandler<A, S>): Handler<A> =>
    async (args: A): Promise<Response> => {
      const { cookies, cookieStore, event } = args;

      const controller = new AbortController();

      const [id, session] = await getSessionProxy<S>(cookies.get(cookieName), event, {
        storage,
        cookieName,
        expirationTtl,
        defaultSession,
        signal: controller.signal,
      });

      const response = await handler({ ...args, session });

      await cookieStore.set({
        name: cookieName,
        value: storage
          ? shortenId(id) ?? ''
          : stringifySessionCookie(session),
        expires: new Date(Date.now() + expirationTtl * 1000),
        sameSite: 'lax',
        httpOnly: true,
      });

      // Indicate that cookie session can no longer be modified.
      controller.abort();

      return response;
    };

async function getSessionProxy<S extends AnyRec = AnyRec>(
  cookieVal: string | null | undefined,
  event: FetchEvent,
  { storage, expirationTtl, defaultSession, signal }: SessionOptions<S> & { signal: AbortSignal },
): Promise<[UUID | null, S]> {
  if (!storage) {
    const obj = (cookieVal && parseSessionCookie<S>(cookieVal)) || defaultSession;

    return [null, new Proxy(<any>obj, {
      set(target, prop, value) {
        if (signal.aborted)
          throw Error('Headers already sent, session can no longer be modified!');
        target[prop] = value;
        return true;
      },

      deleteProperty(target, prop) {
        if (signal.aborted)
          throw Error('Headers already sent, session can no longer be modified!');
        delete target[prop];
        return true;
      }
    })];
  }

  const sessionId = parseUUID(cookieVal) || new UUID();
  const obj = (await storage.get<S>(sessionId)) || defaultSession;

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

  return [sessionId, new Proxy(<any>obj, {
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
  })];
}