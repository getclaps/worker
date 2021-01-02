import { CookieStore, RequestCookieStore } from "@werker/request-cookie-store";
import { BaseArg, Handler } from ".";
import { Awaitable } from "../common-types";
import { SignedCookieStore } from "../signed-cookie-store";

export type WithCookiesArgs = { cookieStore: CookieStore, cookies: Cookies }
export type WithCookiesHandler<A extends BaseArg> = (args: A & WithCookiesArgs) => Awaitable<Response>;

/**
 * A readonly map of the cookies associated with this request.
 * This is for reading convenience (no await required) only.
 * Use `CookieStore` for making changes.
 */
export type Cookies = ReadonlyMap<string, string>;

export interface WithCookieOptions {
  secret: string | BufferSource
  salt?: BufferSource
  deriveHash?: string,
  length?: number,
  iterations?: number
  signHash?: string,
}

/**
 * Issues: 
 * - Forgetting to await a set cookie call can lead to response being sent without the signed cookie.
 *   - Maybe sign cookies in bulk during headers call? => needs knowledge about cookie store internals
 *   - Keep track of in-progress calls?
 * - Can't mix signed and unsigned cookies
 */
export const withSignedCookies = (opts: WithCookieOptions) => {
  const cryptoKeyPromise = SignedCookieStore.deriveCryptoKey(opts);

  return <A extends BaseArg>(handler: WithCookiesHandler<A>): Handler<A> => async (args: A): Promise<Response> => {
    const reqCookieStore = new RequestCookieStore(args.event.request);
    const cookieStore = new SignedCookieStore(reqCookieStore, await cryptoKeyPromise);

    const cookies: Cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));

    const { status, statusText, body, headers } = await handler({ ...args, cookieStore, cookies });

    // New `Response` to work around a known limitation in `Headers` class:
    const response = new Response(body, {
      status,
      statusText,
      headers: [
        ...headers,
        ...reqCookieStore.headers,
      ],
    });
    return response;
  };
}

export const withCookies = <A extends BaseArg>(handler: WithCookiesHandler<A>) => async (args: A): Promise<Response> => {
  const cookieStore = new RequestCookieStore(args.event.request);
  const cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));
  const { status, statusText, body, headers } = await handler({ ...args, cookieStore, cookies });
  const response = new Response(body, {
    status,
    statusText,
    headers: [
      ...headers,
      ...cookieStore.headers,
    ],
  });
  return response;
}

export * from '@werker/request-cookie-store';
