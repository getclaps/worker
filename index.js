import { Client as FaunaDBClient, query as q } from 'faunadb';
import { JSONResponse } from './json-response.js';
import { StorageArea } from './storage-area';
import { makeKey, checkProofOfClap } from './util.js';

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
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleRequest(request, url) {
  const storage = new StorageArea('APPLAUSE_KV');
  const client = new FaunaDBClient({
    secret: Reflect.get(self, 'FAUNA_DB_TEST'),
    fetch: self.fetch.bind(self),
  });

  switch (url.pathname) {
    case '/__init': {
      try {
        // const $1 = await client.query(
        //   q.CreateCollection({ name: 'claps' }),
        // );
        // console.log($1)

        // const $2 = await client.query(
        //   q.CreateIndex({
        //     name: 'claps_by_url',
        //     source: q.Collection('claps'),
        //     terms: [{ field: ['data', 'url'] }],
        //   })
        // );
        // console.log($2)
        return new Response(null)

      } catch (e) { console.error(e) }
      return new JSONResponse(null);
    }
    case '/update-claps': {
      if (request.method === 'POST') {
        try {
          const targetURL = url.searchParams.get('url') || 'https://hydejack.com/';
          const key = await makeKey({ url: targetURL });
          const { claps, id, tx, nonce } = await request.json();

          if (await checkProofOfClap({ url: targetURL, claps, id, tx, nonce }) != true) {
            return new Response(null, { status: 400 })
          }

          const key2 = await makeKey({ url: targetURL, id, tx })
          if (await storage.get(key2) != null) {
            return new Response(null, { status: 409 });
          }
          await storage.set(key2, true);

          const { data } = await client.query(
            q.If(q.Exists(q.Match(q.Index('claps_by_url'), key)),
              q.Update(
                q.Select('ref', q.Get(q.Match(q.Index('claps_by_url'), key))),
                {
                  data: {
                    claps: q.Add(
                      q.Select(['data', 'claps'], q.Get(q.Select('ref', q.Get(q.Match(q.Index('claps_by_url'), key))))),
                      claps,
                    ),
                  },
                },
              ),
              // else
              q.Create(
                q.Collection('claps'),
                {
                  data: { claps, url: key },
                },
              ),
            ),
          );
          return new JSONResponse(data.claps);
        } catch (err) { 
          console.error(err);
          return new Response(null, { status: 500 });
        }
      }
      else if (request.method === 'OPTIONS') {
        return new Response(null);
      }
      return new Response(null, { status: 404 });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        try {
          const targetURL = url.searchParams.get('url') || 'https://hydejack.com/';
          const key = await makeKey({ url: targetURL });

          const { data } = await client.query(q.Get(q.Match(q.Index('claps_by_url'), key)));
          return new JSONResponse(data.claps);
        } catch (err) { 
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
