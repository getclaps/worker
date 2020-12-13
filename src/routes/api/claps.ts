import * as re from '@werker/response-creators';
import { UUID } from 'uuid-class';
import { JSONResponse } from '@werker/json-fetch';
import { checkProofOfClap } from '@getclaps/proof-of-clap';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { router, RouteArgs } from '../../router';

import * as cc from '../cookies';
import { addCORSHeaders } from '../cors';
import { validateURL } from '../validate';
import { extractData } from '../extract';

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function handlePostClaps({ request, headers, searchParams }: RouteArgs) {
  const dao: DAO = getDAO();
  const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(searchParams.get('href') || searchParams.get('url'));

  const { claps, id, nonce } = await request.json();
  if (!RE_UUID.test(id)) {
    return re.badRequest('Malformed id. Needs to be UUID');
  }
  if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
    return re.badRequest('Nonce needs to be integer between 0 and MAX_SAFE_INTEGER');
  }
  if (await checkProofOfClap({ url, claps, id, nonce }) !== true) {
    return re.badRequest('Invalid nonce');
  }

  const extractedData = await extractData(headers);

  const cookies = cc.parseCookie(headers.get('cookie'));

  const data = await dao.updateClaps({
    claps, 
    nonce,
    ...extractedData,
    id: new UUID(id),
    hostname: url.hostname,
    href: url.href,
    hash: url.hash,
  }, {
    originHostname: originURL.hostname,
    ip: headers.get('cf-connecting-ip'),
    dnt: cookies.has(cc.mkDNTCookieKey(url.hostname))
  });

  return new JSONResponse(data);
}

export async function handleGetClaps({ searchParams, headers }: RouteArgs) {
  const dao: DAO = getDAO();
  // const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(searchParams.get('href') || searchParams.get('url'));

  const data = await dao.getClaps({
    href: url.href,
  });

  return new JSONResponse(data);
}

router.options('/claps', args => addCORSHeaders(args)(re.ok()))
router.post('/claps', args => handlePostClaps(args).then(addCORSHeaders(args)));
router.get('/claps', args => handleGetClaps(args).then(addCORSHeaders(args)));
