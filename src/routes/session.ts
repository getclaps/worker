import { UUID } from 'uuid-class';

import { JSONObject } from '../vendor/json-types';
import { KV as database } from '../constants';
import { compressId, elongateId } from '../short-id';

import * as cc from './cookies';

// TODO: make configurable: key, KV database, duration
const SESSION_KEY = 'ASP.NET_SessionId';

const getSessionObj = async (cookies: Map<string, string>): Promise<[UUID, JSONObject]> => {
  const sid = new UUID(elongateId(cookies.get(SESSION_KEY)));
  const sessionObj: JSONObject = await database.get(sid.id, 'json');
  return sessionObj != null ? [sid, sessionObj] : [new UUID(), {}];
}

export const withSession = <T extends { event: FetchEvent, cookies: Cookies }>(handler: (args: T & { session: JSONObject }) => Promise<Response>) => async (args: T): Promise<Response> => {
  const [sid, sessionObj] = await getSessionObj(args.cookies);

  let tid: number;
  const session = new Proxy(sessionObj, {
    set(target, prop, v) {
      Reflect.set(target, prop, v);

      clearInterval(tid);
      tid = setTimeout(() => args.event.waitUntil(
        database.put(sid.id, JSON.stringify(target), { expirationTtl: 5 * 60 })
      ), 10);

      return true;
    }
  })

  const response = await handler({ ...args, session });
  response.headers.append('set-cookie', cc.mkSessionCookie(SESSION_KEY, compressId(sid)));
  return response;
}

export type Cookies = Map<string, string>;
export const withCookies = <T extends { event: FetchEvent }>(handler: (args: T & { cookies: Cookies }) => Promise<Response>) => (args: T): Promise<Response> => {
  const cookies = cc.parseCookie(args.event.request.headers.get('cookie'));
  return handler({ ...args, cookies });
}
