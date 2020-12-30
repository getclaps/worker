import { Awaitable } from "../common-types";
import { CookieStore } from "./cookie-store-types";
import { FetchCookieStore } from "./fetch-cookie-store";
import { SignedCookieStore } from "./signed-cookie-store";

type Args = { event: FetchEvent };
type Handler<A extends Args> = (args: A) => Promise<Response>;
type WithCookiesHandler<A extends Args> = (args: A & { cookieStore: CookieStore, cookies: RequestCookies }) => Awaitable<Response>;

export type RequestCookies = ReadonlyMap<string, string>;

export interface CookieOptions {
  secret: string | BufferSource
  salt?: BufferSource
}

export const withSignedCookies = (opts: CookieOptions) => {
  const cryptoKeyPromise = SignedCookieStore.deriveCryptoKey(opts);

  return <A extends Args>(handler: WithCookiesHandler<A>): Handler<A> => async (args: A): Promise<Response> => {
    const fetchCookieStore = new FetchCookieStore(args.event.request)
    const cookieStore = new SignedCookieStore(fetchCookieStore, cryptoKeyPromise);

    // Parse cookies into a map for convenience. This allows looking up
    const cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));

    const { status, statusText, body, headers } = await handler({ ...args, cookieStore, cookies });

    // New `Response` to work around a known limitation in `Headers` class:
    const response = new Response(body, {
      status,
      statusText,
      headers: [
        ...headers,
        ...fetchCookieStore.headers(),
      ],
    });
    return response;
  };
}

/** @deprecated Use signed cookies instead */
export const withCookies = <T extends Args>(handler: WithCookiesHandler<T>) => async (args: T): Promise<Response> => {
  const cookieStore = new FetchCookieStore(args.event.request);
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


export { toSetCookie } from './fetch-cookie-store';
export * from './cookie-store-types';
