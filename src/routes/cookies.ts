import { Base64Encoder } from "base64-encoding";
import { CookieInit, RequestCookies } from "../vendor/middleware/cookie-store";

const oneYearFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
const shortHash = async (text: string) => new Base64Encoder().encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 7);

export const dntCookieKey = (hostname: string) => `dnt_${encodeURIComponent(hostname)}`;
export const dntCookie = (dnt: boolean, hostname: string): CookieInit => ({
  name: dntCookieKey(hostname),
  sameSite: 'none',
  expires: dnt ? oneYearFromNow() : new Date(0),
})

export const bookmarkedCookieKey = async (id: string) => `bkd_${await shortHash(id)}`;
export const bookmarkedCookie = async (id: string): Promise<CookieInit> => ({
  name: await bookmarkedCookieKey(id),
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

export const loginsCookie = (cookies: RequestCookies, id: string): CookieInit => {
  const ids = cookies.get('ids')?.split(',') ?? [];
  if (id && !ids.includes(id)) ids.push(id);
  return {
    name: 'ids',
    value: ids.join(),
    sameSite: 'lax',
    httpOnly: true,
    expires: oneYearFromNow(),
  }
}

export const hostnameCookieKey = async (id: string) => `hst_${await shortHash(id)}`;
export const hostnameCookie = async (id: string, hostname: string): Promise<CookieInit> => ({
  name: await hostnameCookieKey(id),
  value: hostname,
  sameSite: 'lax',
  expires: oneYearFromNow(),
});

export const logoutsCookie = (cookies: RequestCookies): CookieInit => {
  const did = cookies.get('did');
  const ids = cookies.get('ids')?.split(',').filter(_ => _ !== did)
  return {
    name: 'ids',
    value: ids.join(),
    sameSite: 'lax',
    httpOnly: true,
    expires: oneYearFromNow(),
  }
}
