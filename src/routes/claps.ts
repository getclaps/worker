import { UUID } from 'uuid-class';
import { JSONResponse } from '@werker/json-fetch';
import { ok, badRequest } from '@werker/response-creators';
import { checkProofOfClap } from '@getclaps/proof-of-clap';

import { IP_SALT_KEY, KV } from '../constants';
import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { router, RouteArgs } from '../router';

import { mkDNTCookieKey, parseCookie } from './mk-cookies';
import { addCORSHeaders } from './cors';

export async function extractData(headers: Headers) {
  const country = headers.get('cf-ipcountry');
  const ipSalt = await KV.get(IP_SALT_KEY);
  const visitor = await UUID.v5(headers.get('cf-connecting-ip') || '', ipSalt);
  return { country, visitor };
}

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

// A non-empty scheme component followed by a colon (:),
// consisting of a sequence of characters beginning with a letter and 
// followed by any combination of letters, digits, plus (+), period (.), or hyphen (-).
const RE_PROTOCOL = /^[a-z][a-z0-9.+-]*:/i;

export const validateURL = (url: string) => {
  try {
    if (!url) throw badRequest('No url provided')
    if (url.length > 4096) throw badRequest('URL too long. 4096 characters max.');
    const withProtocol = url.match(RE_PROTOCOL) ? url : `https://${url}`;
    const targetURL = new URL(withProtocol);
    targetURL.search = '';
    return targetURL;
  } catch {
    throw badRequest('Invalid or missing URL');
  }
}

export async function handlePostClaps({ request, requestURL, headers }: RouteArgs) {
  const dao: DAO = getDAO();
  const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(requestURL.searchParams.get('href') || requestURL.searchParams.get('url'));
  ///---

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

  const cookies = parseCookie(headers.get('cookie') || '');

  const data = await dao.updateClaps({
    claps, nonce, country, visitor,
    id: new UUID(id),
    hostname: url.hostname,
    href: url.href,
    hash: url.hash,
  }, {
    originHostname: originURL.hostname,
    ip: headers.get('cf-connecting-ip'),
    dnt: cookies.has(mkDNTCookieKey(url.hostname))
  });

  return new JSONResponse(data);
}

export async function handleGetClaps({ requestURL, headers }: RouteArgs) {
  const dao: DAO = getDAO();
  const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(requestURL.searchParams.get('href') || requestURL.searchParams.get('url'));
  ///---

  const data = await dao.getClaps({
    href: url.href,
  });

  return new JSONResponse(data);
}

// TODO: Need better way to handle CORS...
router.options('/claps', args => addCORSHeaders(args.request)(ok()))
router.post('/claps', args => handlePostClaps(args).then(addCORSHeaders(args.request)));
router.get('/claps', args => handleGetClaps(args).then(addCORSHeaders(args.request)));
