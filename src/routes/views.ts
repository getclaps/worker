import { JSONResponse } from '@werker/json-fetch';
import { ok } from '@werker/response-creators';

import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { router } from '../router';

import { validateURL, extractData } from './claps';
import { mkDNTCookieKey, parseCookie } from './mk-cookies';
import { addCORSHeaders } from './cors';

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

async function handleViews({ headers, requestURL }) {
  const dao: DAO = getDAO();

  const originURL = validateURL(headers.get('origin'));
  const url = validateURL(requestURL.searchParams.get('href') || requestURL.searchParams.get('url'));

  const referrer = getReferrer(requestURL.searchParams.get('referrer'), url.hostname);
  const { country, visitor } = await extractData(headers);

  const cookies = parseCookie(headers.get('cookie') || '');

  const data = await dao.getClapsAndUpdateViews({
    hostname: url.hostname,
    href: url.href,
    referrer,
    country,
    visitor,
  }, {
    originHostname: originURL.hostname,
    ip: headers.get('cf-connecting-ip'),
    dnt: cookies.has(mkDNTCookieKey(url.hostname))
  });

  return new JSONResponse(data);
}

// TODO: Need better way to handle CORS...
router.options('/views', args => addCORSHeaders(args.request)(ok()))
router.post('/views', args => handleViews(args).then(addCORSHeaders(args.request)));
