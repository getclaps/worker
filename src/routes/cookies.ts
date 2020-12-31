import { Base64Encoder } from "base64-encoding";
import { CookieInit, Cookies } from "../vendor/middleware/cookie-store";

const oneMonthFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

/** Short Hash; Takes the first 7 chars of a base 64 encoded SHA-1 hash */
const sash = async (text: string) => new Base64Encoder({ url: true }).encode(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))).slice(0, 7);

export const dntCookieKey = (hostname: string) => `dnt_${encodeURIComponent(hostname)}`;
export const dntCookie = (dnt: boolean, hostname: string): CookieInit => ({
  name: dntCookieKey(hostname),
  value: '',
  sameSite: 'none',
  expires: dnt ? oneMonthFromNow() : new Date(0),
})

export const bookmarkedCookieKey = async (id: string) => `bkd_${await sash(id)}`;
export const bookmarkedCookie = async (id: string): Promise<CookieInit> => ({
  name: await bookmarkedCookieKey(id),
  value: '',
  sameSite: 'lax',
  httpOnly: true,
  expires: oneMonthFromNow(),
})

export const loginCookie = (id: string): CookieInit => ({
  name: 'did',
  value: id,
  sameSite: 'lax',
  httpOnly: true,
  expires: oneMonthFromNow(),
})

export const loginsCookie = (cookies: Cookies, id: string): CookieInit => {
  const ids = cookies.get('ids')?.split(',') ?? [];
  if (id && !ids.includes(id)) ids.push(id);
  return {
    name: 'ids',
    value: ids.join(),
    sameSite: 'lax',
    httpOnly: true,
    expires: oneMonthFromNow(),
  }
}

export const hostnameCookieKey = async (id: string) => `hst_${await sash(id)}`;
export const hostnameCookie = async (id: string, hostname: string): Promise<CookieInit> => ({
  name: await hostnameCookieKey(id),
  value: hostname,
  sameSite: 'lax',
  httpOnly: true,
  expires: oneMonthFromNow(),
});

export const logoutsCookie = (cookies: Cookies): CookieInit => {
  const did = cookies.get('did');
  const ids = cookies.get('ids')?.split(',').filter(_ => _ !== did)
  return {
    name: 'ids',
    value: ids.join(),
    sameSite: 'lax',
    httpOnly: true,
    expires: oneMonthFromNow(),
  }
}
