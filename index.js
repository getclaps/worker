import { Base64Encoder } from 'base64-wasm';
import { UUID } from 'uuid-class';

import { JSONResponse } from './json-response.js'

const CORS_HEADERS = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma',
});

// const EMPTY_UINT8 = new Uint8Array([]);

self.addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url)))
});

const SEPARATOR = ':';

/**
 * @param {string} message 
 */
const digest = async (message) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));

/**
 * @param {URL} url 
 * @param {string} [id]
 */
async function makeKey(url, id) {
  const keyUrl = new URL(url.searchParams.get('url') || 'https://hydejack.com/');
  keyUrl.search = '';
  keyUrl.hash = '';
  const b64e = new Base64Encoder();
  const urlB64 = b64e.encode(await digest(keyUrl.href));
  const idB64 = id ? b64e.encode(new UUID(id).buffer) : '';
  return [urlB64, idB64].join(SEPARATOR);
}

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
        const { claps, id } = await request.json();
        const key = await makeKey(url, id);
        await APPLAUSE_KV.put(key, claps);
        const sum = await count(key);
        return new JSONResponse(sum, { headers: CORS_HEADERS });
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        const key = await makeKey(url);
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
