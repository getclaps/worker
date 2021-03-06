import * as re from '@worker-tools/response-creators';
import { UUID } from 'uuid-class';
import { JSONResponse } from '@worker-tools/json-fetch';
import { StorageArea } from '@worker-tools/kv-storage';
import { checkProofOfClap } from '@getclaps/proof-of-clap';

import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';
import { withCookies } from '../../vendor/middleware/cookies';
import { withCORS } from '../../vendor/middleware/cors';
import * as mime from '../../vendor/middleware/mime';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { router } from '../../router';

import { errors } from '../../errors';
import * as cc from '../cookies';
import { validateURL } from '../validate';
import { extractData } from '../extract';

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const json = withContentNegotiation(<const>{ types: [mime.JSON] });
const jsonBody = withContentNegotiation(<const>{ accepts: [mime.JSON], types: [mime.JSON] });
const cors = withCORS({ credentials: true });
const cookies = withCookies();

router.options('/claps', cors(() => re.ok()))
router.post('/claps', cors(jsonBody(errors(cookies(async ({ request, headers, cookies, searchParams }) => {
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

  const extractedData = await extractData(headers, originURL.hostname);

  const dnt = cookies.has(cc.dntCookieKey(url.hostname)) ||
    ((await new StorageArea().get<string[]>(url.hostname))?.includes(headers.get('cf-connecting-ip') ?? '') ?? false);

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
    dnt,
  });

  return new JSONResponse(data);
})))));

router.get('/claps', cors(json(errors(async ({ searchParams }) => {
  const dao: DAO = getDAO();
  // const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(searchParams.get('href') || searchParams.get('url'));

  const data = await dao.getClaps({
    href: url.href,
  });

  return new JSONResponse(data);
}))));
