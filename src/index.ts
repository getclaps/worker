import * as routes from './routes/index';
import { DAO } from './dao';
import { getDAO } from './dao/get-dao';
import { BadRequestError, ConflictError, NotFoundError, PaymentRequiredError } from './errors';
import { badRequest, conflict, unauthorized, internalServerError, notFound, ok, paymentRequired } from './response-types';

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

function handleError(err: any) {
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof PaymentRequiredError) return paymentRequired(err.message);
  if (err instanceof ConflictError) return conflict(err.message);
  if (err instanceof BadRequestError) return badRequest(err.message);
  if (DEBUG) throw err;
  else return internalServerError();
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
      const dao: DAO = getDAO();
      if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return unauthorized();
      return dao.init().then(() => ok()).catch(handleError);
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
