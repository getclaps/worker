import { Awaitable } from "../common-types";
import { CookieStore } from "./cookie-store-types";
import { FetchCookieStore } from "./fetch-cookie-store";
import { SignedCookieStore } from "./signed-cookie-store";

export type RequestCookies = ReadonlyMap<string, string>;
export type WithCookiesHandler<T> = (args: T & { cookieStore: CookieStore, cookies: RequestCookies }) => Awaitable<Response>;

export const withCookies = <T extends { event: FetchEvent }>(handler: WithCookiesHandler<T>) => async (args: T): Promise<Response> => {
  const cookieStore = new FetchCookieStore(args.event.request);
  const cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));
  // const cookies = new Proxy(
  //   Object.fromEntries((await cookieStore.getAll()).map(({ name, value }) => [name, value])), 
  //   { set() { throw Error('Cannot set values on the cookies object. Use CookieStore instead!') } },
  // );
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

interface CookieOptions {
  secret: string | BufferSource
}

export const withSignedCookies = (opts: CookieOptions) => <T extends { event: FetchEvent }>(handler: WithCookiesHandler<T>) => async (args: T): Promise<Response> => {
  const cookieStore = await SignedCookieStore.create(new FetchCookieStore(args.event.request), opts);
  const cookies = new Map((await cookieStore.getAll()).map(({ name, value }) => [name, value]));
  const { status, statusText, body, headers } = await handler({ ...args, cookieStore, cookies });
  const response = new Response(body, {
    status,
    statusText,
    headers: [
      ...headers,
      ...(<FetchCookieStore>cookieStore.backingStore()).headers(),
    ],
  });
  return response;
}

export { toSetCookie } from './fetch-cookie-store';
export * from './cookie-store-types';
