import { JSONResponse } from './json-response.js';
import { SEPARATOR, makeKey, checkProofOfClap } from './util.js';

const CORS_HEADERS = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma',
});

const BASE_DIFFICULTY = 9;

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)))
});

/**
 * @param {{ prefix?: string, cursor?: string }} listArg 
 * @param {number} init
 * @return {Promise<number>}
 */
async function recurse(listArg, init = 0) {
  const { keys, list_complete: done, cursor: next } = await APPLAUSE_KV.list(listArg);
  let sum = init;
  for (const { name: key } of keys) {
    sum += Number(await APPLAUSE_KV.get(key)) || 0;
  }
  return done ? sum : recurse({ cursor: next }, sum);
}

/**
 * @param {URL} url 
 */
async function count(key) {
  const [prefix] = key.split(SEPARATOR);
  return recurse({ prefix }, 0);
}

/**
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleRequest(request, url) {
  switch (url.pathname) {
    case '/update-claps': {
      if (request.method === 'POST') {
        const { claps, id, tx, nonce } = await request.json();

        const targetUrl = url.searchParams.get('url') || 'https://hydejack.com/';
        const difficulty = BASE_DIFFICULTY + Math.round(Math.log2(claps));
        console.time('check-proof-of-clap');
        const check = await checkProofOfClap({ url: targetUrl, id, tx, nonce }, difficulty);
        console.timeEnd('check-proof-of-clap');
        if (check) {
          const key = await makeKey({ url: targetUrl, id, tx });
          if (!(await APPLAUSE_KV.get(key))) {
            await APPLAUSE_KV.put(key, claps);
            const sum = await count(key);
            return new JSONResponse(sum, { headers: CORS_HEADERS });
          } else {
            return new JSONResponse(null, { headers: CORS_HEADERS, status: 409 });
          }
        } else {
          return new JSONResponse(null, { headers: CORS_HEADERS, status: 400 });
        }
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        const targetUrl = url.searchParams.get('url') || 'https://hydejack.com/';
        const key = await makeKey({ url: targetUrl });

        const sum = await count(key);

        return new JSONResponse(sum, { headers: CORS_HEADERS });
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    default: {
      return new Response(null, { headers: CORS_HEADERS, status: 404 });
    }
  }
}
