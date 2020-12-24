import { UUID } from 'uuid-class';
import { KV as database } from '../constants';
import { compressId, elongateId } from '../short-id';
import * as cc from './cookies';

type JSONable = { toJSON: () => JSONValue }
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray | JSONable;
type JSONObject = { [k: string]: JSONValue };
type JSONArray = JSONValue[];

// TODO: make configurable: key, KV database, duration
const SESSION_KEY = 'ASP.NET_SessionId';

const getSessionObj = async (cookies: Map<string, string>): Promise<[UUID, JSONObject]> => {
  const sid = new UUID(elongateId(cookies.get(SESSION_KEY)));
  const sessionObj: JSONObject = await database.get(sid.id, 'json');
  return sessionObj != null ? [sid, sessionObj] : [new UUID(), {}];
}

export const withSession = <T extends { event: FetchEvent, cookies: Cookies }>(handler: (args: T & { session: JSONObject }) => Promise<Response>) => async (args: T): Promise<Response> => {
  const [sid, session] = await getSessionObj(args.cookies);

  try {
    const response = await handler({ ...args, session });

    // FIXME: Do full combination of responses!!!
    const { body, headers, status, statusText } = response;
    return new Response(body, {
      status, statusText,
      headers: [
        ...headers, 
        ['Set-Cookie', cc.mkSessionCookie(SESSION_KEY, compressId(sid))],
      ],
    });
  } finally {
    args.event.waitUntil(
      database.put( sid.id, JSON.stringify(session), { 
        expirationTtl: 5 * 60 
      }),
    );
  }
}

export type Cookies = Map<string, string>;
export const withCookies = <T extends { event: FetchEvent }>(handler: (args: T & { cookies: Cookies }) => Promise<Response>) => (args: T): Promise<Response> => {
  const cookies = cc.parseCookie(args.event.request.headers.get('cookie'));
  return handler({ ...args, cookies });
}
