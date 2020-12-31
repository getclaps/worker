import * as re from '@werker/response-creators';

import { Awaitable } from '../../vendor/common-types';
import { withCookies } from '../../vendor/middleware/cookies';
import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { parseUUID } from '../../vendor/short-id';
import { RouteArgs, DashboardArgs } from '../../router';

import * as cc from '../cookies';

type DashboardHandler = (args: DashboardArgs) => Awaitable<Response>;

const acceptHTML = withContentNegotiation({ types: ['text/html'] });
// const withCookies = withSignedCookies({ secret: 'foobar' });

export const withDashboard = (handler: DashboardHandler) => withCookies<RouteArgs>(acceptHTML(async (args): Promise<Response> => {
  const { headers, event, cookies } = args;

  const dao: DAO = getDAO();

  const id = cookies.get('did');
  if (!id) throw re.seeOther('/login');

  const uuid = parseUUID(id);

  const isBookmarked = cookies.has(await cc.bookmarkedCookieKey(id));

  const [locale] = args.language?.split('-') ?? ['en'];
  const response = await handler({ ...args, locale, id, uuid, cookies, dao, isBookmarked });

  event.waitUntil((async () => {
    const ip = headers.get('cf-connecting-ip');
    if (ip != null) {
      await dao.upsertDashboard({ id: uuid, ip });
    }
  })());

  return response;
}));
