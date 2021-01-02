import { CookieInit, Cookies } from "../vendor/middleware/cookies";

const oneMonthFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

export const dntCookieKey = (hostname: string) => `dnt_${encodeURIComponent(hostname)}`;
export const dntCookie = (dnt: boolean, hostname: string): CookieInit => ({
  name: dntCookieKey(hostname),
  value: '',
  sameSite: 'none',
  expires: dnt ? oneMonthFromNow() : new Date(0),
})
