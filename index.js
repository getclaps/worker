import * as r from './response-types';
import * as routes from './routes/index.js';
import { FaunaDAO } from './fauna-dao.js';

export const DEBUG = Boolean(Reflect.get(self, 'DEBUG') === 'true');

/**
 * @param {string} pathname 
 */
const getPath = (pathname) => {
  const x = `/${pathname}/`.replace(/\/+/g, '/');
  return x.substr(1, x.length - 2).split('/');
}

/**
 * @param {Request} request 
 * @returns {(response: Response) => Response} 
 */
const addCORSHeaders = (request) => (response) => {
  response.headers.set('access-control-allow-origin', request.headers.get('origin'));
  if (request.headers.has('access-control-request-method')) response.headers.set('access-control-allow-methods', request.headers.get('access-control-request-method'));
  if (request.headers.has('access-control-request-headers')) response.headers.set('access-control-allow-headers', request.headers.get('access-control-request-headers'));
  response.headers.set('access-control-allow-credentials', 'true');
  return response;
}

/** @param {any} err */
const handleError = (err) => {
  if (err instanceof Response) return err;
  else if (DEBUG) throw err;
  else return r.internalServerError();
}

self.addEventListener('fetch', /** @param {FetchEvent} event */ event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)));
});

/**
 * @public
 * @typedef {{
 *   request: Request,
 *   requestURL: URL,
 *   headers: Headers,
 *   method: string,
 *   pathname: string,
 *   path: string[],
 * }} RouteParams 
 */

/**
 * @param {Request} request
 * @param {URL} requestURL
 * @returns {Promise<Response>}
 */
async function handleRequest(request, requestURL) {
  const { method, headers } = request;
  const { pathname } = requestURL;

  const path = getPath(pathname);

  /** @type {RouteParams} */
  const args = { request, requestURL, method, pathname, path, headers };

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
      return r.notFound();
    }
  }
}
