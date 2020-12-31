import { CookieInit } from './cookie-store-interface';

export const attrsToSetCookie = (attrs: string[][]) => attrs.map(as => as.join('=')).join('; ');

export function setCookie(options: string | CookieInit, value?: string, origin?: URL) {
  const [name, val] = typeof options === 'string'
    ? [options, value]
    : [options.name, options.value ?? '']

  if (!name.length && val.includes('=')) throw Error()
  if (!name.length && !val.length) throw Error();

  const attrs = [[name, val]];
  const host = origin?.host;
  let expires = null;

  if (typeof options !== 'string') {
    const { domain, path = '/', sameSite } = options;

    if (domain) {
      if (domain.startsWith('.')) throw Error();
      if (host && !host.endsWith(`.${domain}`)) throw Error()
      attrs.push(['Domain', domain]);
    }

    if (options.expires) {
      expires = options.expires instanceof Date
        ? options.expires
        : new Date(options.expires);
      attrs.push(['Expires', expires.toUTCString()]);
    }

    attrs.push(['Path', path]);

    if (origin && origin.hostname !== 'localhost')
      attrs.push(['Secure']);

    if (options.httpOnly)
      attrs.push(['HttpOnly']);

    switch (sameSite) {
      case 'none': attrs.push(['SameSite', 'None']); break;
      case 'lax': attrs.push(['SameSite', 'Lax']); break;
      case 'strict': attrs.push(['SameSite', 'Strict']); break;
    }
  }

  return [name, val, attrs, expires] as [string, string, string[][], Date|null];
}
