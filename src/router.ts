import { Router, Method, Params } from 'tiny-request-router';
import { UUID } from 'uuid-class';
import { DAO } from './dao';
import { Awaitable } from './vendor/common-types';
import { CookieStore, RequestCookies } from './vendor/middleware/cookie-store';

export interface RouteArgs {
  event: FetchEvent;
  request: Request;
  requestURL: URL;
  pathname: string;
  searchParams: URLSearchParams
  headers: Headers;
  method: Method;
  params: Params;
}

export interface DashboardArgs extends RouteArgs {
  id: string;
  uuid: UUID;
  cookies: RequestCookies;
  cookieStore: CookieStore;
  dao: DAO;
  isBookmarked: boolean;
  locale: string;
}

export type Handler = (args: RouteArgs) => Awaitable<Response>;

export const router = new Router<Handler>();
