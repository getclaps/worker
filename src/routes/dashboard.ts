import * as re from '@werker/response-creators';

import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { elongateId } from '../short-id';
import * as cc from './cookies';

import { router, dashboardRouter } from '../router';

import './dashboard/index';

router.all('/(stats|log|settings|subscription)', async (params) => {
  const { method, pathname, headers, event } = params;
  const match = dashboardRouter.match(method, pathname);
  if (match) {
    const dao: DAO = getDAO();
    const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

    const cookies = cc.parseCookie(headers.get('cookie') || '');

    const id = cookies.get('did');
    if (!id) return re.seeOther('/login');

    const uuid = elongateId(id);

    const isBookmarked = cookies.has(await cc.mkBookmarkedCookieKey(id));

    event.waitUntil((async () => {
      const ip = headers.get('cf-connecting-ip');
      if (ip != null) {
        await dao.upsertDashboard({ id: uuid, ip });
      }
    })());

    return match.handler({ ...params, id, uuid, cookies, dao, isBookmarked, locale });
  }
  return re.notFound();
});
