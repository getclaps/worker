import * as re from '@werker/response-creators';
import { JSONResponse } from '@werker/json-fetch';

import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';
import { withCookies } from '../../vendor/middleware/cookies';
import { withCORS } from '../../vendor/middleware/cors';
import * as mime from '../../vendor/middleware/mime';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { router } from '../../router';

import { withErrors as errors } from '../../errors';
import * as cc from '../cookies';
import { validateURL } from '../validate';
import { extractData } from '../extract';
import { storage } from '../../constants';

function getReferrer(referrerRaw: string | null, hostname: string): string | undefined {
  if (referrerRaw != null) {
    let refURL: URL;
    try { refURL = validateURL(referrerRaw) } catch { return }
    if (refURL.hostname !== hostname) {
      return refURL.pathname === '/' && !refURL.href.endsWith('/')
        ? `${refURL.href}/` // Cloudflare URL fix
        : refURL.href;
    }
  }
}

const json = withContentNegotiation(<const>{ types: [mime.JSON] });
const cors = withCORS({ credentials: true });
const cookies = withCookies();

router.options('/views', cors(() => re.ok()))
router.post('/views', cors(json(errors(cookies(async ({ headers, cookies, searchParams }) => {
  const dao: DAO = getDAO();

  const originURL = validateURL(headers.get('origin'));
  const url = validateURL(searchParams.get('href') || searchParams.get('url'));

  const referrer = getReferrer(searchParams.get('referrer'), url.hostname);
  const extractedData = await extractData(headers, originURL.hostname);

  const dnt = cookies.has(cc.dntCookieKey(url.hostname)) ||
    ((await storage.get<string[]>(url.hostname))?.includes(headers.get('cf-connecting-ip') ?? '') ?? false);

  const data = await dao.getClapsAndUpdateViews({
    hostname: url.hostname,
    href: url.href,
    referrer,
    ...extractedData
  }, {
    originHostname: originURL.hostname,
    dnt,
  });

  return new JSONResponse(data);
})))));
