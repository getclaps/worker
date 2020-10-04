import { FaunaDAO } from '../fauna-dao';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';

import { validateURL, extractData } from './claps';

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

  const dao = new FaunaDAO();

  const originURL = validateURL(headers.get('origin'));
  const url = validateURL(requestURL.searchParams.get('href') || requestURL.searchParams.get('url'));
  if (![url.hostname, 'localhost'].includes(originURL.hostname)) {
    return badRequest("Origin doesn't match");
  }

  const referrer = getReferrer(requestURL.searchParams.get('referrer'), url.hostname);
  const { country, visitor } = await extractData(headers);

  const arg = {
    hostname: originURL.hostname,
    href: url.href,
    referrer,
    country,
    visitor,
  };

  return (headers.get('cookie') || '').includes(`dnt=${encodeURIComponent(url.hostname)}`)
    ? dao.getClaps(arg)
    : dao.getClapsAndUpdateViews(arg, headers.get('cf-connecting-ip'));
}
