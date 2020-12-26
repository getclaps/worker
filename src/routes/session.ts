import { UUID } from 'uuid-class';

import { JSONValue } from '../vendor/json-types';
import { compressId, elongateId } from '../short-id';

import { Cookies, mkSessionCookie } from './cookies';
import { Awaitable } from '../router';

type Args = { event: FetchEvent, cookies: Cookies };
type WithSessionHandler<T> = (args: T & { session: Session }) => Awaitable<Response>

interface SessionOptions {
  kv: KVNamespace,
  sessionKey?: string,
  expirationTtl?: number,
}

const coerceJSON = (v: JSONValue) => JSON.parse(JSON.stringify(v));

const create = Symbol('Session.create');

export class Session extends Map<string, JSONValue> {
  id: UUID

  private event: FetchEvent;
  private kv: KVNamespace
  private expirationTtl: number;

  private static async [create]({ event, cookies }: Args, { kv, sessionKey, expirationTtl }: SessionOptions) {
    let sid = new UUID(elongateId(cookies.get(sessionKey)));
    const obj = await kv.get(sid.id, 'json') as any;
    sid = obj != null ? sid : new UUID();
    return new Session(create, obj ?? {}, sid, event, { kv, expirationTtl });
  }

  private constructor(caller: symbol, obj: object, id: UUID, event: FetchEvent, { kv, expirationTtl }: SessionOptions) {
    if (caller !== create) throw Error('Illegal constructor');
    super(Object.entries(obj));
    this.id = id;
    this.event = event;
    this.kv = kv;
    this.expirationTtl = expirationTtl;
  }

  private tid: number;

  set(key: string, value: JSONValue): this {
    super.set(key, coerceJSON(value));

    // Batch calls within the same micro task:
    clearInterval(this.tid);
    this.tid = setTimeout(() => this.event.waitUntil(
      this.kv.put(this.id.id, JSON.stringify(this), { expirationTtl: this.expirationTtl })
    ));

    return this;
  }

  toJSON() {
    return Object.fromEntries(this.entries())
  }
}

export const withSession = ({ kv, sessionKey = 'sid', expirationTtl = 5 * 60 }: SessionOptions) => 
  <T extends Args>(handler: WithSessionHandler<T>) => 
    async (args: T): Promise<Response> => {
      const session = await Session[create](args, { kv, sessionKey, expirationTtl })
      const response = await handler({ ...args, session });
      response.headers.append('set-cookie', mkSessionCookie(sessionKey, compressId(session.id)));
      return response;
    };
