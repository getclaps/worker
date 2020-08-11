import { FaunaDAO } from './fauna-dao.js';
import { ok, badRequest, forbidden, notFound, redirect } from './response-types';
import { handleDashboard } from './routes/dashboard.js';
import { handleClaps } from './routes/claps.js';

/**
 * @param {string} pathname 
 */
const getPath = (pathname) => {
  const x = `/${pathname}/`.replace(/\/+/g, '/');
  return x.substr(1, x.length - 2).split('/');
}

/**
 * @param {Response} r 
 */
const addCORSHeaders = (r) => {
  r.headers.set('Access-Control-Allow-Origin', '*');
  r.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma, Authorization');
  return r;
}

self.addEventListener('fetch', /** @param {FetchEvent} event */ event => {
  event.respondWith(
    handleRequest(event.request, new URL(event.request.url))
      .catch(err => {
        if (err instanceof Response) return err;
        console.error('err', err.message);
        return new Response(null, { status: 500 });
      })
      .then(addCORSHeaders)
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
    case 'dashboard': {
      return handleDashboard({ request, requestURL, method, pathname, path, headers })
    }
    default: {
      return notFound();
    }
  }
}
