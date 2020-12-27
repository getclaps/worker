import { Router, Method, Params } from 'tiny-request-router';
import { UUID } from 'uuid-class';
import { DAO } from './dao';
import { CookieStore } from './routes/cookie-store';

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
  cookies: CookieStore
  dao: DAO;
  isBookmarked: boolean;
  locale: string;
}

export type Awaitable<T> = T | Promise<T>;
export type Handler = (args: RouteArgs) => Awaitable<Response>;

export const router = new Router<Handler>();
