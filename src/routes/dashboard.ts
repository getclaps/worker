import * as re from '@werker/response-creators';

import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { elongateId } from '../short-id';
import * as cc from './cookies';

import { RouteArgs, DashboardArgs } from '../router';

import './dashboard/index';

export async function beforeDashboard(params: RouteArgs): Promise<DashboardArgs> {
  const { headers, event } = params;

  const dao: DAO = getDAO();
  const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

  const cookies = cc.parseCookie(headers.get('cookie') || '');

  const id = cookies.get('did');
  if (!id) throw re.seeOther('/login');

  const uuid = elongateId(id);

  const isBookmarked = cookies.has(await cc.mkBookmarkedCookieKey(id));

  event.waitUntil((async () => {
    const ip = headers.get('cf-connecting-ip');
    if (ip != null) {
      await dao.upsertDashboard({ id: uuid, ip });
    }
  })());

  return { ...params, id, uuid, cookies, dao, isBookmarked, locale };
}
