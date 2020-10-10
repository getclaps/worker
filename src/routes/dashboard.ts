import { UUID } from 'uuid-class';
import { Base64Encoder } from 'base64-encoding';

import { RouteParams } from '../index';
import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { elongateId, shortenId } from '../short-id';
import { badRequest, notFound, seeOther } from '../response-types';
import * as pages from './dashboard/index';
import { stripeAPI } from './stripe';

export { styles } from './dashboard/styles';

const WORKER_DOMAIN = Reflect.get(self, 'WORKER_DOMAIN');
const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

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

const mkLogoutCookie = () => {
  return `did=; Path=/; SameSite=Lax; ${Secure} HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

export const parseCookie = (cookie: string) => new Map<string, string>(cookie.split(/;\s*/)
  .map(x => x.split('='))
  .map(([k, v]) => [k, v] as [string, string])
  .filter(([k]) => !!k)
);

export interface Snowball extends RouteParams {
  id: string;
  uuid: UUID;
  cookies: Map<string, string>;
  dao: DAO;
  isBookmarked: boolean;
  locale: string;
}

export async function handleDashboard(params: RouteParams) {
  const { request, requestURL, event, headers, method, path: [, dir] } = params;

  const dao: DAO = getDAO();

  const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

  if (dir === 'new') {
    if (method !== 'GET') return notFound();

    const sessionId = requestURL.searchParams.get('session_id');
    if (!sessionId) return notFound();

    const { customer, subscription } = await stripeAPI(`/v1/checkout/sessions/${sessionId}`);

    if (!subscription || !customer) return badRequest();

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

    return seeOther(new URL(`/`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLoginCookie(shortenId(id))]],
    });
  }

  else if (dir === 'logout') {
    return seeOther(new URL(`/`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLogoutCookie()]]
    });
  }

  else if (dir === 'login') {
    if (method === 'POST') {
      const formData = await request.formData()
      const id = formData.get('password').toString();
      // const hostname = formData.get('id').toString();
      const referrer = formData.get('referrer') || '/';

      try {
        const uuid = elongateId(id);
        const d = await dao.getDashboard(uuid);
        if (!d) throw Error();
      } catch {
        return seeOther(new URL(referrer.toString(), WORKER_DOMAIN))
      }

      return seeOther(new URL(referrer.toString(), WORKER_DOMAIN), {
        headers: [
          ['Set-Cookie', mkLoginCookie(id)],
          ['Set-Cookie', await mkBookmarkedCookie(id)]
        ],
      });
    }

    return notFound();
  }

  else if (/([A-Za-z0-9-_]{22})/.test(dir)) {
    const [, id] = dir.match(/([A-Za-z0-9-_]{22})/);
    return seeOther(new URL(`/`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLoginCookie(id)]],
    });
  }

  else {
    // if (!(headers.get('accept') || '').includes('text/html')) return r.badRequest();
    const cookies = parseCookie(headers.get('cookie') || '');

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

    return res;
  }
}
