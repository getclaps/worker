import { BaseArg, Handler } from ".";
import { Awaitable } from "../common-types";
import { CookieStore, HeadersCookieStore } from "../headers-cookie-store";
import { SignedCookieStore } from "../signed-cookie-store";

export type WithCookiesDeps = BaseArg;
export type WithCookiesArgs = { cookieStore: CookieStore, cookies: Cookies }
export type WithCookiesHandler<A extends WithCookiesDeps> = (args: A & WithCookiesArgs) => Awaitable<Response>;

/**
 * A readonly map of the cookies associated with this request.
 * This is for reading convenience (no await required) only.
 * Use `CookieStore` for making changes.
 */
export type Cookies = ReadonlyMap<string, string>;

export interface WithCookieOptions {
  secret: string | BufferSource
  salt?: BufferSource
}

export const withSignedCookies = (opts: WithCookieOptions) => {
  const cryptoKeyPromise = SignedCookieStore.deriveCryptoKey(opts);

  return <A extends WithCookiesDeps>(handler: WithCookiesHandler<A>): Handler<A> => async (args: A): Promise<Response> => {
    const reqCookieStore = new HeadersCookieStore(args.event.request.headers);
    const cookieStore = new SignedCookieStore(reqCookieStore, await cryptoKeyPromise);

    const cookies: Cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));

    const { status, statusText, body, headers } = await handler({ ...args, cookieStore, cookies });

    // New `Response` to work around a known limitation in `Headers` class:
    const response = new Response(body, {
      status,
      statusText,
      headers: [
        ...headers,
        ...reqCookieStore.headers(),
      ],
    });
    return response;
  };
}

export const withCookies = <A extends WithCookiesDeps>(handler: WithCookiesHandler<A>) => async (args: A): Promise<Response> => {
  const cookieStore = new HeadersCookieStore(args.event.request.headers);
  const cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));
  const { status, statusText, body, headers } = await handler({ ...args, cookieStore, cookies });
  const response = new Response(body, {
    status,
    statusText,
    headers: [
      ...headers,
      ...cookieStore.headers(),
    ],
  });
  return response;
}

export * from '../headers-cookie-store';
