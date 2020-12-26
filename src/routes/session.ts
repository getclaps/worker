import { UUID } from 'uuid-class';

import { JSONObject, JSONValue } from '../vendor/json-types';
import { compressId, elongateId } from '../short-id';

import { Cookies, mkSessionCookie } from './cookies';

const getSessionObj = async (kv: KVNamespace, sessionKey: string, cookies: Cookies): Promise<[UUID, JSONObject]> => {
  const sid = new UUID(elongateId(cookies.get(sessionKey)));
  const sessionObj: JSONObject = await kv.get(sid.id, 'json');
  return sessionObj 
    ? [sid, sessionObj] 
    : [new UUID(), {}];
}

interface SessionOptions {
  kv: KVNamespace,
  sessionKey?: string,
  expirationTtl?: number,
}

const coerceJSONVal = (v: JSONValue) => JSON.parse(JSON.stringify(v));

export const withSession = ({ kv, sessionKey = 'sid', expirationTtl = 5 * 60 }: SessionOptions) => 
  <T extends { event: FetchEvent, cookies: Cookies }>(handler: (args: T & { session: JSONObject }) => Promise<Response>) => 
    async (args: T): Promise<Response> => {
      const [sid, sessionObj] = await getSessionObj(kv, sessionKey, args.cookies);

      let tid: number;
      const session = new Proxy(sessionObj, {
        set(target, prop, v) {
          Reflect.set(target, prop, coerceJSONVal(v));

          clearInterval(tid);
          tid = setTimeout(() => args.event.waitUntil(
            kv.put(sid.id, JSON.stringify(target), { expirationTtl })
          ), 10);

          return true;
        }
      })

      const response = await handler({ ...args, session });
      response.headers.append('set-cookie', mkSessionCookie(sessionKey, compressId(sid)));
      return response;
    };
