import { UUID } from 'uuid-class';

import { JSONObject, JSONValue } from '../vendor/json-types';
import { compressId, elongateId } from '../short-id';

import { Cookies, mkSessionCookie } from './cookies';

interface SessionOptions {
  kv: KVNamespace,
  sessionKey?: string,
  expirationTtl?: number,
}

const coerceJSONVal = (v: JSONValue) => JSON.parse(JSON.stringify(v));

class Session extends Map<string, JSONValue> {
  id: UUID

  #kv: KVNamespace
  #tid: number;
  #event: FetchEvent;
  #expirationTtl: number;

  static async from(cookies: Cookies, event: FetchEvent, { kv, sessionKey = 'sid', expirationTtl = 5 * 60 }: SessionOptions) {
    let sid = new UUID(elongateId(cookies.get(sessionKey)));
    const obj: any = await kv.get(sid.id, 'json');
    sid = obj != null ? sid : new UUID();
    return new Session(obj ?? {}, sid, kv, event, expirationTtl);
  }

  private constructor(obj: object, id: UUID, kv: KVNamespace, event: FetchEvent, expirationTtl: number) {
    super(Object.entries(obj));
    this.id = id;
    this.#kv = kv;
    this.#event = event;
    this.#expirationTtl = expirationTtl;
  }

  set(key: string, value: JSONValue): this {
    super.set(key, coerceJSONVal(value));

    clearInterval(this.#tid);
    this.#tid = setTimeout(() => this.#event.waitUntil(
      this.#kv.put(this.id.id, JSON.stringify(this), { expirationTtl: this.#expirationTtl })
    ), 10);

    return this;
  }

  toJSON() {
    return Object.fromEntries(this.entries())
  }
}

export const withSession = (opts: SessionOptions) => 
  <T extends { event: FetchEvent, cookies: Cookies }>(handler: (args: T & { session: Session }) => Promise<Response>) => 
    async (args: T): Promise<Response> => {
      const session = await Session.from(args.cookies, args.event, opts)
      const response = await handler({ ...args, session });
      response.headers.append('set-cookie', mkSessionCookie(opts.sessionKey, compressId(session.id)));
      return response;
    };
