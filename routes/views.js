import { FaunaDAO } from '../fauna-dao.js';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';

import { validateURL } from './claps';

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
export async function handleViews({ requestURL, method, path, headers }) {
  if (path.length > 1) return notFound();
  if (method !== 'POST') return notFound();

  const dao = new FaunaDAO();

  const originURL = validateURL(headers.get('Origin'));
  const url = validateURL(requestURL.searchParams.get('url')); // TODO: rename to href?

  if (![url.hostname, 'localhost', '0.0.0.0'].includes(originURL.hostname)) {
    return badRequest("Origin doesn't match");
  }

  const country = headers.get('cf-ipcountry');

  return await dao.getClapsAndUpdateViews({
    hostname: originURL.hostname,
    href: url.href,
    country,
  });
}