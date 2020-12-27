import { Awaitable } from "../common-types";
import { CookieStore, SyncCookieStore } from "./cookie-store-types";
import { FetchEventCookieStore } from "./fetch-event-cookie-store";

type WithCookiesHandler<T> = (args: T & { cookies: SyncCookieStore }) => Awaitable<Response>;

export const withCookies = <T extends { event: FetchEvent }>(handler: WithCookiesHandler<T>) => async (args: T): Promise<Response> => {
  const cookies = new FetchEventCookieStore(args.event.request);
  const { status, statusText, body, headers } = await handler({ ...args, cookies });
  const response = new Response(body, {
    status,
    statusText,
    headers: [
      ...headers,
      ...cookies.headers(),
    ],
  });
  return response;
}

export { toSetCookie } from './fetch-event-cookie-store';
export * from './cookie-store-types';
