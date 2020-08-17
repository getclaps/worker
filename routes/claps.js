import { UUID } from 'uuid-class';

import { checkProofOfClap } from '../util.js';
import { FaunaDAO } from '../fauna-dao.js';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';

export const IP_NAMESPACE = '393e8e4f-bb49-4c17-83eb-444b5be4885b';

/**
 * @param {Headers} headers 
 */
export async function extractData(headers) {
  const country = headers.get('cf-ipcountry');
  const visitor = await UUID.v5(headers.get('cf-connecting-ip') || '', IP_NAMESPACE);
  return { country, visitor };
}

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/**
 * @param {string} url 
 */
export const validateURL = (url) => {
  try {
    if (!url) throw badRequest('No url provided')
    if (url.length > 4096) throw badRequest('URL too long. 4096 characters max.');
    const targetURL = new URL(url)
    targetURL.search = ''
    return targetURL;
  } catch {
    throw badRequest('Invalid URL. Needs to be fully qualified, e.g. https://getclaps.dev');
  }
}

/**
 * @param {{
 * request: Request,
 * requestURL: URL,
 * headers: Headers,
 * method: string,
 * pathname: string,
 * path: string[],
 * }} param0 
 */
export async function handleClaps({ request, requestURL, method, path, headers }) {
  if (path.length > 1) return notFound();

  const dao = new FaunaDAO();

  const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(requestURL.searchParams.get('url')); // TODO: rename to href?
  if (![url.hostname, 'localhost'].includes(originURL.hostname)) {
    return badRequest("Origin doesn't match");
  }

  switch (method) {
    case 'POST': {
      const { claps, id, nonce } = await request.json();
      if (!RE_UUID.test(id)) {
        return badRequest('Malformed id. Needs to be UUID');
      }
      if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
        return badRequest('Nonce needs to be integer between 0 and MAX_SAFE_INTEGER');
      }
      if (await checkProofOfClap({ url, claps, id, nonce }) !== true) {
        return badRequest('Invalid nonce');
      }

      const { country, visitor } = await extractData(headers);

      return dao.updateClaps({
        claps, nonce, country, visitor,
        id: new UUID(id),
        hostname: originURL.hostname,
        href: url.href,
        hash: url.hash,
      });
    }

    case 'GET': {
      return await dao.getClaps({
        hostname: originURL.hostname,
        href: url.href,
      });
    }

    default: return notFound();
  }
}