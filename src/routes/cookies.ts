import { Base64Encoder } from "base64-encoding";
import { WORKER_DOMAIN } from "../constants";

export const parseCookie = (cookie: string) => new Map<string, string>(cookie?.split(/;\s*/)
  .map(x => x.split('='))
  .map(([k, v]) => [k, v] as [string, string])
  .filter(([k]) => !!k)
);

const oneYearFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

const shortHash = async (text: string) => new Base64Encoder().encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 7);

const Secure = WORKER_DOMAIN.includes('localhost') ? '' : 'Secure;';

export const mkDNTCookieKey = (hostname: string) => `dnt_${encodeURIComponent(hostname)}`;
export const mkDNTCookie = (dnt: boolean, hostname: string) => {
  return dnt
    ? `${mkDNTCookieKey(hostname)}=; Path=/; SameSite=None; ${Secure} Expires=${oneYearFromNow().toUTCString()}`
    : `${mkDNTCookieKey(hostname)}=; Path=/; SameSite=None; ${Secure} Expires=Thu, 01 Jan 1970 00:00:01 GMT;`
}

export const mkBookmarkedCookieKey = async (id: string) => `bkd_${await shortHash(id)}`;
export const mkBookmarkedCookie = async (id: string) => {
  return `${await mkBookmarkedCookieKey(id)}=; Path=/; SameSite=Lax; ${Secure} Expires=${oneYearFromNow().toUTCString()}`;
}

export const mkLoginCookie = (id: string) => {
  return `did=${id}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

export const mkLoginsCookie = (cookies: Map<string, string>, id: string) => {
  const ids = cookies.get('ids')?.split(',') ?? [];
  if (!ids.includes(id)) ids.push(id);
  return `ids=${ids.join(',')}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

export const mkHostnameCookieKey = async (id: string) => `hst_${await shortHash(id)}`;
export const mkHostnameCookie = async (id: string, hostname: string) => {
  return `${await mkHostnameCookieKey(id)}=${hostname}; Path=/; SameSite=Lax; ${Secure} Expires=${oneYearFromNow().toUTCString()}`;
}

export const mkLogoutCookie = () => {
  return `did=; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

export const mkLogoutsCookie = (cookies: Map<string, string>, id: string) => {
  let ids = cookies.get('ids')?.split(',') ?? [];
  ids = ids.filter(_ => _ !== id);
  return `ids=${ids.join(',')}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

export const mkSessionCookie = (name: string, ssid: string) => {
  return `${name}=${ssid}; Path=/; SameSite=Lax; ${Secure} HttpOnly`;
}
