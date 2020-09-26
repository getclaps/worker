import * as r from './response-types';
import * as routes from './routes/index';
import { FaunaDAO } from './fauna-dao';

export const DEBUG = Boolean(Reflect.get(self, 'DEBUG') === 'true');

const getPath = (pathname: string) => {
  const x = `/${pathname}/`.replace(/\/+/g, '/');
  return x.substr(1, x.length - 2).split('/');
}

const addCORSHeaders = (request: Request) => (response: Response) => {
  response.headers.set('access-control-allow-origin', request.headers.get('origin'));
  if (request.headers.has('access-control-request-method')) response.headers.set('access-control-allow-methods', request.headers.get('access-control-request-method'));
  if (request.headers.has('access-control-request-headers')) response.headers.set('access-control-allow-headers', request.headers.get('access-control-request-headers'));
  response.headers.set('access-control-allow-credentials', 'true');
  return response;
}

const handleError = (err: any) => {
  if (err instanceof Response) return err;
  else if (DEBUG) throw err;
  else return r.internalServerError();
}

self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url), event));
});

export interface RouteParams {
  request: Request;
  requestURL: URL;
  event: FetchEvent;
  headers: Headers;
  method: string;
  pathname: string;
  path: string[];
}

async function handleRequest(request: Request, requestURL: URL, event: FetchEvent) {
  const { method, headers } = request;
  const { pathname } = requestURL;

  const path = getPath(pathname);

  const args: RouteParams = { request, requestURL, event, method, pathname, path, headers };

  switch (path[0]) {
    case '__init': {
      const dao = new FaunaDAO();
      if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return r.forbidden();
      return dao.init().catch(handleError);
    }
    case 'claps': {
      return routes.handleClaps(args).catch(handleError).then(addCORSHeaders(request));
    }
    case 'views': {
      return routes.handleViews(args).catch(handleError).then(addCORSHeaders(request));
    }
    case 'dashboard': {
      return routes.handleDashboard(args).catch(handleError);
    }
   default: {
      args.path = ['dashboard', ...path];
      return routes.handleDashboard(args).catch(handleError);
    }
  }
}
