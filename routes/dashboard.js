import { UUID } from 'uuid-class';

import { FaunaDAO } from '../fauna-dao.js';
import { elongateId, shortenId } from '../short-id';
import { stripeAPI } from './stripe.js';
import * as r from '../response-types';
import * as pages from './dashboard/index';

export { styles } from './dashboard/styles';

const WORKER_DOMAIN = Reflect.get(self, 'WORKER_DOMAIN');
const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

const oneYearFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

// /** @param {string} text */
// const shortHash = async (text) => new Base64Encoder().encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 7);

const Secure = WORKER_DOMAIN.includes('localhost') ? '' : 'Secure;';

/** @param {string} hostname */ export const mkDNTCookieKey = hostname => `dnt_${encodeURIComponent(hostname)}`;
/** @param {string} hostname @param {boolean} dnt */ export const mkDNTCookie = (dnt, hostname) => {
  return dnt
    ? `${mkDNTCookieKey(hostname)}=; Path=/; SameSite=None; ${Secure}; HttpOnly; Expires=${oneYearFromNow().toUTCString()}`
    : `${mkDNTCookieKey(hostname)}=; Path=/; SameSite=None; ${Secure}; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`
}

/** @param {string} hostname */ export const mkBookmarkedCookieKey = hostname => `bkd_${encodeURIComponent(hostname)}`;
/** @param {string} hostname */ export const mkBookmarkedCookie = hostname => {
  return `${mkBookmarkedCookieKey(hostname)}=; Path=/; SameSite=Lax; ${Secure} Expires=${oneYearFromNow().toUTCString()}`;
}

/** @param {string} id */
const mkLoginCookie = (id) => {
  return `did=${id}; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

const mkLogoutCookie = () => {
  return `did=; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

/** @param {string} cookie @returns {Map<string, string>} */
const parseCookie = (cookie) => new Map(cookie.split(/;\s*/)
  .map(x => x.split('='))
  .map(/** @returns {[string, string]} */([k, v]) => [k, v])
  .filter(([k]) => !!k)
);

/**
 * @public
 * @typedef {import('../index').RouteParams & { 
 *   id: string,
 *   uuid: UUID, 
 *   dashboard: any, 
 *   cookies: Map<string, string>, 
 *   dao: FaunaDAO, 
 *   isBookmarked: boolean, 
 *   locale: string 
 * }} Snowball 
 */

/** 
 * @param {import('../index').RouteParams} params 
 */
export async function handleDashboard(params) {
  const { request, requestURL, headers, method, path: [, dir] } = params;

  const dao = new FaunaDAO();

  const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

  if (dir === 'new') {
    if (method !== 'GET') return r.notFound();

    const sessionId = requestURL.searchParams.get('session_id');
    if (!sessionId) return r.notFound();

    const { customer, subscription } = await stripeAPI(`/v1/checkout/sessions/${sessionId}`);

    if (!subscription || !customer) return r.badRequest();

    const id = await UUID.v5(sessionId, NAMESPACE);

    await stripeAPI(`/v1/subscriptions/${subscription}`, {
      method: 'POST',
      data: { 'metadata[dashboard_id]': shortenId(id) },
    });

    await dao.upsertDashboard({
      id,
      customer,
      subscription,
      active: true,
      dnt: false,
    });

    return r.redirect(new URL(`/`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLoginCookie(shortenId(id))]],
    });
  }

  else if (dir === 'logout') {
    return r.redirect(new URL(`/`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLogoutCookie()]]
    });
  }

  else if (dir === 'login') {
    if (method === 'POST') {
      const formData = await request.formData()
      const id = formData.get('password').toString();
      const hostname = formData.get('id').toString();

      try {
        const uuid = elongateId(id);
        const d = await dao.getDashboard(uuid);
        if (!d) throw Error();
      } catch {
        return r.redirect(new URL(`/`, WORKER_DOMAIN))
      }

      return r.redirect(new URL(`/`, WORKER_DOMAIN), {
        headers: [
          ['Set-Cookie', mkLoginCookie(id)],
          ['Set-Cookie', mkBookmarkedCookie(hostname)]
        ],
      });
    }

    return r.notFound();
  }

  else if (/([A-Za-z0-9-_]{22})/.test(dir)) {
    const [, id] = dir.match(/([A-Za-z0-9-_]{22})/);
    return r.redirect(new URL(`/`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLoginCookie(id)]],
    });
  }

  else {
    // if (!(headers.get('accept') || '').includes('text/html')) return r.badRequest();
    const cookies = parseCookie(headers.get('cookie') || '');

    const id = cookies.get('did');
    if (!id) return pages.loginPage();

    const uuid = elongateId(id);
    const dashboard = await dao.getDashboard(uuid);

    const isBookmarked = cookies.has(mkBookmarkedCookieKey(dashboard.hostname));

    const ip = headers.get('cf-connecting-ip');
    if (ip != null && dashboard.ip !== ip) {
      await dao.upsertDashboard({ id: uuid, ip });
    }

    if (dir === 'settings') {
      return pages.settingsPage({ ...params, id, uuid, dashboard, cookies, dao, isBookmarked, locale });
    }
    else if (dir === 'stats') {
      return pages.statsPage({ ...params, id, uuid, dashboard, cookies, dao, isBookmarked, locale });
    }
    else if (!dir) {
      return pages.homePage({ ...params, id, uuid, dashboard, cookies, dao, isBookmarked, locale });
    }
    else {
      return r.notFound();
    }
  }
}
