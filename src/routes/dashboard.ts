import { UUID } from 'uuid-class';
import { Base64Encoder } from 'base64-encoding';
import { methodNotAllowed, notFound, seeOther } from '@werker/response-creators';

import { WORKER_DOMAIN, HAS_BILLING } from '../constants';
import { RouteArgs } from '../index';
import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { elongateId, shortenId } from '../short-id';
import * as pages from './dashboard/index';

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

const mkLoginCookie = (id: string) => {
  return `did=${id}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

const mkLoginsCookie = (cookies: Map<string, string>, id: string) => {
  const ids = cookies.get('ids')?.split(',') ?? [];
  if (!ids.includes(id)) ids.push(id);
  return `ids=${ids.join(',')}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

export const mkHostnameCookieKey = async (id: string) => `hst_${await shortHash(id)}`;
export const mkHostnameCookie = async (id: string, hostname: string) => {
  return `${await mkHostnameCookieKey(id)}=${hostname}; Path=/; SameSite=Lax; ${Secure} Expires=${oneYearFromNow().toUTCString()}`;
}

const mkLogoutCookie = () => {
  return `did=; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

const mkLogoutsCookie = (cookies: Map<string, string>, id: string) => {
  let ids = cookies.get('ids')?.split(',') ?? [];
  ids = ids.filter(_ => _ !== id);
  return `ids=${ids.join(',')}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

export const parseCookie = (cookie: string) => new Map<string, string>(cookie.split(/;\s*/)
  .map(x => x.split('='))
  .map(([k, v]) => [k, v] as [string, string])
  .filter(([k]) => !!k)
);

export interface DashboardArgs extends RouteArgs {
  id: string;
  uuid: UUID;
  cookies: Map<string, string>;
  dao: DAO;
  isBookmarked: boolean;
  locale: string;
}

export async function handleDashboard(params: RouteArgs) {
  const { request, requestURL, event, headers, method, path: [, dir] } = params;

  const dao: DAO = getDAO();

  const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

  const cookies = parseCookie(headers.get('cookie') || '');

  if (dir === 'new') {
    if (method !== 'GET') return methodNotAllowed();

    let props: { id: UUID, [prop: string]: any };
    if (HAS_BILLING) {
      const { newProps } = await import(/* webpackMode: "eager" */ '../billing/re-new');
      props = await newProps(requestURL);
    } else {
      props = { id: UUID.v4() };
    }

    await dao.upsertDashboard({
      ...props,
      active: true,
      dnt: false,
      hostname: [],
      views: 0,
    });

    return seeOther(new URL(`/`, WORKER_DOMAIN), {
      headers: [
        ['Set-Cookie', mkLoginCookie(shortenId(props.id))],
        ['Set-Cookie', mkLoginsCookie(cookies, shortenId(props.id))],
      ],
    });
  }
  
  else if (dir === 'renew') {
    if (method !== 'GET') return methodNotAllowed();

    const id = elongateId(requestURL.searchParams.get('did'));
    const dashboard = await dao.getDashboard(id);

    let props: { id: UUID, [prop: string]: any };
    if (HAS_BILLING) {
      const { renewProps } = await import(/* webpackMode: "eager" */ '../billing/re-new');
      props = await renewProps(requestURL, dashboard);
    } else {
      props = { id };
    }

    await dao.upsertDashboard({
      ...props,
      active: true,
    });

    return seeOther(new URL(`/subscription`, WORKER_DOMAIN), {
      headers: [
        ['Set-Cookie', mkLoginCookie(shortenId(props.id))],
        ['Set-Cookie', mkLoginsCookie(cookies, shortenId(props.id))],
      ],
    });
  }

  else if (dir === 'logout') {
    const did = cookies.get('did');
    const ids = cookies.get('ids')?.split(',')?.filter(_ => _ !== did) ?? [];
    return seeOther(new URL(`/`, WORKER_DOMAIN), {
      headers: [
        ['Set-Cookie', ids.length ? mkLoginCookie(ids[0]) : mkLogoutCookie()],
        ['Set-Cookie', mkLogoutsCookie(cookies, cookies.get('did'))],
      ],
    });
  }

  else if (dir === 'login') {
    if (method === 'POST') {
      const formData = await request.formData()
      const id = formData.get('password').toString();
      const hostname = formData.get('id')?.toString();
      const referrer = (formData.get('referrer')  || request.headers.get('referer') || '/').toString();

      try {
        const uuid = elongateId(id);
        const d = await dao.getDashboard(uuid);
        if (!d) throw Error();
      } catch {
        return seeOther(new URL(referrer, WORKER_DOMAIN))
      }

      return seeOther(new URL(referrer, WORKER_DOMAIN), {
        headers: [
          ['Set-Cookie', mkLoginCookie(id)],
          ['Set-Cookie', mkLoginsCookie(cookies, id)],
          ['Set-Cookie', await mkBookmarkedCookie(id)],
          ...hostname ? [['Set-Cookie', await mkHostnameCookie(id, hostname)]] : [],
        ],
      });
    } else if (method === 'GET') {
      return pages.loginPage({ referrer: '/stats' });
    } else {
      return methodNotAllowed();
    }
  }

  else if (/([A-Za-z0-9-_]{22})/.test(dir)) {
    const [, id] = dir.match(/([A-Za-z0-9-_]{22})/);
    return seeOther(new URL(`/`, WORKER_DOMAIN), {
      headers: [
        ['Set-Cookie', mkLoginCookie(id)],
        ['Set-Cookie', mkLoginsCookie(cookies, id)],
      ],
    });
  }

  else {
    // if (!(headers.get('accept') || '').includes('text/html')) return r.badRequest();

    const id = cookies.get('did');
    if (!id) return pages.loginPage();

    const uuid = elongateId(id);

    const isBookmarked = cookies.has(await mkBookmarkedCookieKey(id));

    event.waitUntil((async () => {
      const ip = headers.get('cf-connecting-ip');
      if (ip != null) {
        await dao.upsertDashboard({ id: uuid, ip });
      }
    })());

    const snowball = { ...params, id, uuid, cookies, dao, isBookmarked, locale };

    let res: Response;
    if (dir === 'settings') {
      res = await pages.settingsPage(snowball);
    }
    else if (dir === 'stats') {
      res = await pages.statsPage(snowball);
    }
    else if (dir === 'log') {
      res = await pages.logPage(snowball);
    }
    else if (dir === 'subscription' && HAS_BILLING) {
      const { subscriptionPage } = await import(/* webpackMode: "eager" */ '../billing/subscription');
      res = await subscriptionPage(snowball);
    }
    else if (!dir) {
      if (isBookmarked) {
        res = seeOther(new URL('/stats', WORKER_DOMAIN));
      } else {
        res = seeOther(new URL('/settings', WORKER_DOMAIN));
      }
    }
    else {
      res = notFound();
    }

    res.headers.append('Set-Cookie', mkLoginCookie(id));
    res.headers.append('Set-Cookie', mkLoginsCookie(cookies, id));

    return res;
  }
}
