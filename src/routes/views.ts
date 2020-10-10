import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { JSONResponse } from '../json-fetch';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';

import { validateURL, extractData } from './claps';
import { mkDNTCookieKey, parseCookie } from './dashboard';

function getReferrer(referrerRaw: string|null, hostname: string): string|undefined {
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

export async function handleViews({ requestURL, method, path, headers }: {
  request: Request,
  requestURL: URL,
  headers: Headers,
  method: string,
  pathname: string,
  path: string[],
}) {
  if (path.length > 1) return notFound();
  if (method === 'OPTIONS') return ok();
  if (method !== 'POST') return notFound();

  const dao: DAO = getDAO();

  const originURL = validateURL(headers.get('origin'));
  const url = validateURL(requestURL.searchParams.get('href') || requestURL.searchParams.get('url'));
  if (![url.hostname, 'localhost'].includes(originURL.hostname)) {
    return badRequest("Origin doesn't match");
  }

  const referrer = getReferrer(requestURL.searchParams.get('referrer'), url.hostname);
  const { country, visitor } = await extractData(headers);

  const cookies = parseCookie(headers.get('cookie') || '');

  const data = await dao.getClapsAndUpdateViews({
    hostname: originURL.hostname,
    href: url.href,
    referrer,
    country,
    visitor,
  }, {
    ip: headers.get('cf-connecting-ip'),
    dnt: cookies.has(mkDNTCookieKey(url.hostname))
  }); 

  return new JSONResponse(data);
}
