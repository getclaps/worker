import { FaunaDAO } from './fauna-dao.js';
import { ok, badRequest, forbidden, notFound, redirect } from './response-types';
import { handleDashboard } from './routes/dashboard.js';
import { handleClaps } from './routes/claps.js';

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

  if (pathname.startsWith('/__init')) {
    const dao = new FaunaDAO();
    if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return forbidden();
    return dao.init()
  }
  else if (pathname.startsWith('/claps')) {
    return handleClaps({ request, requestURL, method, pathname, headers });
  } 
  else if (pathname.startsWith('/dashboard')) {
    return handleDashboard({ request, requestURL, method, pathname, headers })
  }

  return notFound();
}
