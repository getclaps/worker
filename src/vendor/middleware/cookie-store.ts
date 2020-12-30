import { BaseArg, Handler } from ".";
import { Awaitable } from "../common-types";
import { CookieStore, FetchCookieStore } from "../fetch-cookie-store";
import { SignedCookieStore } from "../signed-cookie-store";

export type WithCookiesDeps = BaseArg;
export type WithCookiesArgs = { cookieStore: CookieStore, cookies: RequestCookies }
export type WithCookiesHandler<A extends WithCookiesDeps> = (args: A & WithCookiesArgs) => Awaitable<Response>;

export type RequestCookies = ReadonlyMap<string, string>;

export interface WithCookieOptions {
  secret: string | BufferSource
  salt?: BufferSource
}

export const withSignedCookies = (opts: WithCookieOptions) => {
  const cryptoKeyPromise = SignedCookieStore.deriveCryptoKey(opts);

  return <A extends WithCookiesDeps>(handler: WithCookiesHandler<A>): Handler<A> => async (args: A): Promise<Response> => {
    const fetchCookieStore = new FetchCookieStore(args.event.request);
    const cookieStore = new SignedCookieStore(fetchCookieStore, await cryptoKeyPromise);

    // Parse cookies into a map for convenience. This allows looking up values synchronously.
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

export const withCookies = <A extends WithCookiesDeps>(handler: WithCookiesHandler<A>) => async (args: A): Promise<Response> => {
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

export * from '../fetch-cookie-store';
