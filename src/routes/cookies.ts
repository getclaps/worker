import { Base64Encoder } from "base64-encoding";
import { CookieInit, CookieStore } from "./cookie-store";

const oneYearFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

const shortHash = async (text: string) => new Base64Encoder().encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 7);

export const mkDNTCookieKey = (hostname: string) => `dnt_${encodeURIComponent(hostname)}`;

export const dntCookie = (dnt: boolean, hostname: string): CookieInit => ({
  name: mkDNTCookieKey(hostname),
  sameSite: 'none',
  expires: dnt ? oneYearFromNow() : new Date(0),
})

export const mkBookmarkedCookieKey = async (id: string) => `bkd_${await shortHash(id)}`;
export const bookmarkedCookie = async (id: string): Promise<CookieInit> => ({
  name: await mkBookmarkedCookieKey(id),
  sameSite: 'lax',
  expires: oneYearFromNow(),
})

export const loginCookie = (id: string): CookieInit => ({
  name: 'did',
  value: id,
  sameSite: 'lax',
  httpOnly: true,
  expires: oneYearFromNow(),
})

export const loginsCookie = async (cookies: CookieStore, id: string): Promise<CookieInit> => {
  const ids = (await cookies.get('ids'))?.value.split(',') ?? [];
  if (id && !ids.includes(id)) ids.push(id);
  return {
    name: 'ids',
    value: ids.join(),
    sameSite: 'lax',
    httpOnly: true,
    expires: oneYearFromNow(),
  }
}

export const mkHostnameCookieKey = async (id: string) => `hst_${await shortHash(id)}`;
export const hostnameCookie = async (id: string, hostname: string): Promise<CookieInit> => ({
  name: await mkHostnameCookieKey(id),
  value: hostname,
  sameSite: 'lax',
  expires: oneYearFromNow(),
});

export const logoutsCookie = async (cookies: CookieStore): Promise<CookieInit> => {
  const id = (await cookies.get('id'))?.value;
  let ids = (await cookies.get('ids'))?.value.split(',') ?? [];
  ids = ids.filter(_ => _ !== id);
  return {
    name: 'ids',
    value: ids.join(),
    sameSite: 'lax',
    httpOnly: true,
    expires: oneYearFromNow(),
  }
}
