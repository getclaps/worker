import * as re from '@werker/response-creators';
import { JSONResponse } from '@werker/json-fetch';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { router } from '../../router';

import { withCORS } from '../cors';
import { withErrors } from '../../errors';
import * as cc from '../cookies';
import { validateURL } from '../validate';
import { extractData } from '../extract';
import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';
import { withCookies } from '../../vendor/middleware/cookie-store';

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

const acceptJSON = withContentNegotiation({ types: ['application/json'] });

router.options('/views', withCORS(() => re.ok()))
router.post('/views', withCORS(withErrors(withCookies(acceptJSON(async ({ headers, cookies, searchParams }) => {
  const dao: DAO = getDAO();

  const originURL = validateURL(headers.get('origin'));
  const url = validateURL(searchParams.get('href') || searchParams.get('url'));

  const referrer = getReferrer(searchParams.get('referrer'), url.hostname);
  const extractedData = await extractData(headers, originURL.hostname);

  const data = await dao.getClapsAndUpdateViews({
    hostname: url.hostname,
    href: url.href,
    referrer,
    ...extractedData
  }, {
    originHostname: originURL.hostname,
    ip: headers.get('cf-connecting-ip'),
    dnt: !!cookies.get(cc.mkDNTCookieKey(url.hostname))
  });

  return new JSONResponse(data);
})))));
