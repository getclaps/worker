import { JSONResponse } from './json-response.js';
import { SEPARATOR, makeKey, checkProofOfClap, calcDifficulty } from './util.js';

/**
 * @param {Response} r 
 */
const addCORSHeaders = (r) => {
  r.headers.set('Access-Control-Allow-Origin', '*');
  r.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  return r;
}

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)).then(addCORSHeaders));
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
        const difficulty = calcDifficulty(claps);

        console.time('check-proof-of-clap');
        const check = await checkProofOfClap({ url: targetUrl, id, tx, nonce }, difficulty);
        console.timeEnd('check-proof-of-clap');

        if (check) {
          const key = await makeKey({ url: targetUrl, id, tx });
          if (!(await APPLAUSE_KV.get(key))) {
            await APPLAUSE_KV.put(key, claps);
            const sum = await count(key);
            return new JSONResponse(sum);
          } else {
            return new JSONResponse(null, { status: 409 });
          }
        } else {
          return new JSONResponse(null, { status: 400 });
        }
      }
      return new JSONResponse(null, { status: 404 });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        const targetUrl = url.searchParams.get('url') || 'https://hydejack.com/';
        const key = await makeKey({ url: targetUrl });

        const sum = await count(key);

        return new JSONResponse(sum);
      }
      return new JSONResponse(null, { status: 404 });
    }
    default: {
      return new Response(null, { status: 404 });
    }
  }
}
