import { notFound, seeOther } from '@werker/response-creators';

import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { elongateId, shortenId } from '../short-id';
import { mkBookmarkedCookieKey, mkLoginCookie, mkLoginsCookie, parseCookie } from './mk-cookies';

import { router, dashboardRouter } from '../router';

import './dashboard/index';

router.all('/(stats|log|settings|subscription)', async (params) => {
  const { method, pathname, headers, event } = params;
  const match = dashboardRouter.match(method, pathname);
  if (match) {
    const dao: DAO = getDAO();
    const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

    const cookies = parseCookie(headers.get('cookie') || '');

    const id = cookies.get('did');
    if (!id) return seeOther('/login');

    const uuid = elongateId(id);

    const isBookmarked = cookies.has(await mkBookmarkedCookieKey(id));

    event.waitUntil((async () => {
      const ip = headers.get('cf-connecting-ip');
      if (ip != null) {
        await dao.upsertDashboard({ id: uuid, ip });
      }
    })());

    return match.handler({ ...params, id, uuid, cookies, dao, isBookmarked, locale });
  }
  return notFound();
});
