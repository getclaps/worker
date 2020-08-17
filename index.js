import { FaunaDAO } from './fauna-dao.js';
import { ok, badRequest, forbidden, notFound, redirect, internalServerError } from './response-types';
import { handleDashboard } from './routes/dashboard.js';
import { handleClaps } from './routes/claps.js';
import { handleViews } from './routes/views.js';

const DEBUG = Boolean(Reflect.get(self, 'DEBUG') === 'true');

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
  return response;
}

self.addEventListener('fetch', /** @param {FetchEvent} event */ event => {
  event.respondWith(
    handleRequest(event.request, new URL(event.request.url))
      .catch(err => {
        if (err instanceof Response) return err;
        else if (DEBUG) throw err;
        else return internalServerError();
      })
      .then(addCORSHeaders(event.request))
  );
});

/**
 * @param {Request} request
 * @param {URL} requestURL
 * @returns {Promise<Response>}
 */
async function handleRequest(request, requestURL) {
  const { method, headers } = request;
  const { pathname } = requestURL;

  if (method === 'OPTIONS') return new Response();

  const path = getPath(pathname);

  switch (path[0]) {
    case '__init': {
      const dao = new FaunaDAO();
      if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return forbidden();
      return dao.init()
    }
    case 'claps': {
      return handleClaps({ request, requestURL, method, pathname, path, headers });
    }
    case 'views': {
      return handleViews({ request, requestURL, method, pathname, path, headers });
    }
    case 'dashboard': {
      return handleDashboard({ request, requestURL, method, pathname, path, headers })
    }
    default: {
      return notFound();
    }
  }
}
