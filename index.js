class JSONResponse extends Response {
  /**
   * @param {any} [body] 
   * @param {ResponseInit} [init] 
   * @param {(this: any, key: string, value: any) => any} [replacer] 
   * @param {string | number} [space]
   */
  constructor(body, init, replacer, space) {
    const { headers: h, ...rest } = init || {};

    const b = body != null ? JSON.stringify(body, replacer, space) : null;

    const headers = new Headers(h);
    if (b) headers.set('Content-Type', 'application/json;charset=UTF-8');

    super(b, { headers, ...rest });
  }
}

const CORS_HEADERS = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma',
});

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)))
});

/**
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleRequest(request, url) {
  switch (url.pathname) {
    case '/update-claps': {
      if (request.method === 'POST') {
        const { claps } = await request.json();
        const value = Number(await APPLAUSE_KV.get(url.searchParams.get('url'))) || 0;
        const newValue = value + claps || value;
        await APPLAUSE_KV.put(url.searchParams.get('url'), newValue);
        return new JSONResponse(newValue, { headers: CORS_HEADERS });
      } else {
        return new JSONResponse(null, { headers: CORS_HEADERS });
      }
    }
    case '/get-claps': {
      const value = Number(await APPLAUSE_KV.get(url.searchParams.get('url'))) || 0;
      console.log(value)
      return new JSONResponse(value, { headers: CORS_HEADERS });
    }
    default: {
      return new Response('Hello worker foo!', {
        headers: { 'content-type': 'text/plain' },
      });
    }
  }
}
