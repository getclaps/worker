import { FaunaDAO } from '../fauna-dao';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';

import { validateURL, extractData } from './claps';

// A non-empty scheme component followed by a colon (:),
// consisting of a sequence of characters beginning with a letter and 
// followed by any combination of letters, digits, plus (+), period (.), or hyphen (-).
const RE_PROTOCOL = /^[a-z][a-z0-9.+-]*:/i;

function getReferrer(referrerRaw: string|null, hostname: string): string|undefined {
  if (referrerRaw != null) {
    let refURL: URL;
    try { 
      refURL = validateURL(referrerRaw.match(RE_PROTOCOL) ? referrerRaw : `https://${referrerRaw}`);
    } catch { return }
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
