import { Base64Encoder } from 'base64-wasm';
import { WebUUID } from 'web-uuid';

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

/**
 * @param {URL} url 
 * @param {string} [id]
 */
async function makeKey(url, id) {
  const keyUrl = new URL(url.searchParams.get('url') || 'https://hydejack.com/');
  keyUrl.search = '';
  keyUrl.hash = '';
  const urlBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyUrl.href)));
  // const idUint8Array = id ? new Uint8Array(new UUID(id).buffer) : EMPTY_UINT8;
  const urlB64 = new Base64Encoder({ urlFriendly: true }).encode(urlBytes);
  const idB64 = id ? new WebUUID(id).wid : '';
  return `${urlB64}/${idB64}`;
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
        console.log(key)
        const value = Number(await APPLAUSE_KV.get(key)) || 0;
        const newValue = value + claps || value;
        await APPLAUSE_KV.put(key, newValue);
        return new JSONResponse(newValue, { headers: CORS_HEADERS });
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    case '/get-claps': {
      if (request.method === 'GET') {
        const prefix = await makeKey(url);
        // TODO: pagination
        const { keys } = await APPLAUSE_KV.list({ prefix });
        let sum = 0;
        for (const { name: key } of keys) {
          sum += Number(await APPLAUSE_KV.get(key)) || 0;
        }
        return new JSONResponse(sum, { headers: CORS_HEADERS });
      }
      return new JSONResponse(null, { headers: CORS_HEADERS });
    }
    default: {
      return new Response(null, { headers: CORS_HEADERS, status: 404 });
    }
  }
}
