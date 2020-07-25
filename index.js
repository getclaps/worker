import { Client as FaunaDBClient, query as q } from 'faunadb';
import { JSONResponse } from './json-response.js';
import { makeKey, checkProofOfClap } from './util.js';

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
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  return r;
}

self.addEventListener('fetch', /** @param {FetchEvent} event */ event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)).then(addCORSHeaders));
});

/**
 * @param {Request} request
 * @param {URL} requestURL
 * @returns {Promise<Response>}
 */
async function handleRequest(request, requestURL) {
  const client = new FaunaDBClient({
    secret: Reflect.get(self, 'FAUNA_DB_KEY'),
    fetch: self.fetch.bind(self),
  });

  switch (requestURL.pathname) {
    case '/__init': {
      try {
        // const $1 = await client.query(q.CreateCollection({ name: 'claps' }));
        // console.log($1)

        // const $2 = await client.query(
        //   q.CreateIndex({
        //     name: 'claps_by_url',
        //     source: q.Collection('claps'),
        //     terms: [{ field: ['data', 'url'] }],
        //   })
        // );
        // console.log($2)

        // const $3 = await client.query(q.CreateCollection({ name: 'proofs' }));
        // console.log($3)

        // const $4 = await client.query(
        //   q.CreateIndex({
        //     name:   'proofs_by_binary',
        //     source: q.Collection('proofs'),
        //     terms:  [{ field: [ 'data', 'key' ] }],
        //     unique: true
        //   }),
        // );
        // console.log($4);

        return new Response()

      } catch (e) { console.error(e) }
      return new Response();
    }
    case '/update-claps': {
      if (request.method === 'POST') {
        try {
          const url = validateURL(requestURL.searchParams.get('url') || 'https://hydejack.com/');

          const { claps, id, tx, nonce } = await request.json();
          if (!RE_UUID.test(id)) {
            return new Response('Malformed id. Needs to be UUID', { status: 400 });
          }
          if (!Number.isInteger(tx) || tx < 0 || tx > Number.MAX_SAFE_INTEGER) {
            return new Response('Tx needs to be integer between 0 and MAX_SAFE_INTEGER', { status: 400 });
          }
          if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
            return new Response('Nonce needs to be integer between 0 and MAX_SAFE_INTEGER', { status: 400 });
          }
          if (await checkProofOfClap({ url, claps, id, tx, nonce }) != true) {
            return new Response('Invalid nonce', { status: 400 })
          }

          const key = await makeKey({ url, id, tx, nonce });
          try { 
            const { data } = await client.query(
              q.Do(
                q.Create(q.Collection('proofs'), { data: { key } }),
                q.If(q.Exists(q.Match(q.Index('claps_by_url'), url.href)),
                  q.Update(
                    q.Select('ref', q.Get(q.Match(q.Index('claps_by_url'), url.href))),
                    {
                      data: {
                        claps: q.Add(
                          q.Select(['data', 'claps'], q.Get(q.Select('ref', q.Get(q.Match(q.Index('claps_by_url'), url.href))))),
                          claps,
                        ),
                      },
                    },
                  ),
                  // else
                  q.Create(q.Collection('claps'), { data: { claps, url: url.href } }),
                ),
              )
            );
            return new JSONResponse(data.claps);
          } catch { 
            return new Response(null, { status: 409 })
          }
        } catch (err) {
          if (err instanceof Response) return err;
          console.error(err);
          return new Response(null, { status: 500 });
        }
      }
      else if (request.method === 'OPTIONS') {
        return new Response();
      }
      return new Response(null, { status: 404 });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        try {
          const url = validateURL(requestURL.searchParams.get('url') || 'https://hydejack.com/');
          const { data } = await client.query(q.Get(q.Match(q.Index('claps_by_url'), url.href)));
          return new JSONResponse(data.claps);
        } catch (err) {
          if (err instanceof Response) return err;
          if (err.name === 'NotFound') return new JSONResponse(0);
          console.error('err', err);
          return new Response(null, { status: 500 });
        }
      }
      return new Response(null, { status: 404 });
    }
    default: {
      return new Response(null, { status: 404 });
    }
  }
}
