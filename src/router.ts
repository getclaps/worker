import { HTMLResponse } from '@werker/html';
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

type Handler = (args: RouteArgs) => Response | Promise<Response>
export const router = new Router<Handler>();

// type APIHandler = (args: RouteArgs) => Response | Promise<Response>
// export const apiRouter = new Router<APIHandler>();

type DashboardHandler = (args: DashboardArgs) => HTMLResponse | Promise<HTMLResponse>;
export const dashboardRouter = new Router<DashboardHandler>();
