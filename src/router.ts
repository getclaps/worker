import { Router, Method, Params } from 'tiny-request-router';
import { UUID } from 'uuid-class';
import { DAO } from './dao';

export interface RouteArgs {
  request: Request;
  requestURL: URL;
  searchParams: URLSearchParams
  event: FetchEvent;
  headers: Headers;
  method: Method;
  pathname: string;
  params: Params;
}

export interface DashboardArgs extends RouteArgs {
  id: string;
  uuid: UUID;
  cookies: Map<string, string>;
  dao: DAO;
  isBookmarked: boolean;
  locale: string;
}

export type Awaitable<T> = T | Promise<T>;
export type Handler = (args: RouteArgs) => Awaitable<Response>;

export const router = new Router<Handler>();
