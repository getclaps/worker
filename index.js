import { checkProofOfClap } from './util.js';
import { DAO } from './dao';

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/**
 * @param {string} url 
 */
export const validateURL = (url) => {
  try {
    if (url.length > 4096) throw new Response('URL too long. 4096 characters max.', { status: 400 });
    const targetURL = new URL(url)
    targetURL.search = ''
    return targetURL;
  } catch {
    throw new Response('Invalid URL. Needs to be fully qualified, e.g. https://hydejack.com', { status: 400 });
  }
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
      .catch(err => (console.error('err', err), new Response(null, { status: 500 })))
      .then(addCORSHeaders)
  );
});

/**
 * @param {Request} request
 * @param {URL} requestURL
 * @returns {Promise<Response>}
 */
async function handleRequest(request, requestURL) {

  if (request.method === 'OPTIONS') return new Response();

  const dao = await DAO.getDAOForPlatform();

  switch (requestURL.pathname) {
    case '/claps/__init': {
      if (request.headers.get('Authorization') === Reflect.get(self, 'AUTH')) {
        return await dao.init()
      }
      return new Response(null, { status: 401 });
    }
    case '/claps': {
      try {
        const url = validateURL(requestURL.searchParams.get('url') || 'https://hydejack.com/');

        switch (request.method) {
          case 'POST': {
            const { claps, id, nonce } = await request.json();
            if (!RE_UUID.test(id)) {
              return new Response('Malformed id. Needs to be UUID', { status: 400 });
            }
            if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
              return new Response('Nonce needs to be integer between 0 and MAX_SAFE_INTEGER', { status: 400 });
            }
            if (await checkProofOfClap({ url, claps, id, nonce }) != true) {
              return new Response('Invalid nonce', { status: 400 })
            }

            return dao.updateClaps({ url, id, claps, nonce }, request);
          }
          case 'GET': {
            const url = validateURL(requestURL.searchParams.get('url') || 'https://hydejack.com/');
            return await dao.getClaps(url);
          }
          default: {
            return new Response(null, { status: 404 });
          }
        }
      } catch (err) {
        if (err instanceof Response) return err;
        throw err;
      }
    }
    default: {
      return new Response(null, { status: 404 });
    }
  }
}
