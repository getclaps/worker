import { Router, Method, Params } from 'tiny-request-router';
import { UUID } from 'uuid-class';
import { DAO } from './dao';
import { Awaitable } from './vendor/common-types';
import { CookieStore, Cookies } from './vendor/middleware/cookies';

export interface RouteArgs {
  event: FetchEvent;
  request: Request;
  url: URL;
  pathname: string;
  searchParams: URLSearchParams
  headers: Headers;
  method: Method;
  params: Params;
}

export interface DashboardArgs extends RouteArgs {
  id: string;
  uuid: UUID;
  cookies: Cookies;
  cookieStore: CookieStore;
  dao: DAO;
  isBookmarked: boolean;
  locale: string;
  session: DashboardSession
}

export interface DashboardSession {
  cid?: string,
  ids: string[]
  bookmarked: Set<string>,
  hostnames: Map<string, string>
}

export type Handler = (args: RouteArgs) => Awaitable<Response>;

export const router = new Router<Handler>();
