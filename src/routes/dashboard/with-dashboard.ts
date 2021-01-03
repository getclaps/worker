import * as re from '@werker/response-creators';
import { KVStorageArea } from '@werker/cloudflare-kv-storage';

import { Awaitable } from '../../vendor/common-types';
import { withSignedCookies } from '../../vendor/middleware/cookies';
import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';
import { withSession } from '../../vendor/middleware';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { parseUUID } from '../../vendor/short-id';
import { RouteArgs, DashboardArgs, DashboardSession } from '../../router';
import { AUTH, KV } from '../../constants';

type DashboardHandler = (args: DashboardArgs) => Awaitable<Response>;

const acceptHTML = withContentNegotiation(<const>{ types: ['text/html'] });
export const dashCookies = withSignedCookies({ secret: AUTH });
export const dashSession = withSession<DashboardSession>({
  storage: new KVStorageArea(KV),
  cookieName: 'sidx',
  defaultSession: {
    ids: [],
    bookmarked: new Set(),
    hostnames: new Map()
  },
  expirationTtl: 60 * 60 * 24 * 365,
});

export const withDashboard = (handler: DashboardHandler) => dashCookies<RouteArgs>(dashSession(acceptHTML(async (args): Promise<Response> => {
  const { headers, event, session } = args;

  const dao: DAO = getDAO();

  const id = session.cid;
  if (!id) throw re.seeOther('/login');

  const uuid = parseUUID(id);

  const isBookmarked = session.bookmarked.has(id);

  const [locale] = args.language?.split('-') ?? ['en'];
  const response = await handler({ ...args, locale, id, uuid, session, dao, isBookmarked });

  event.waitUntil((async () => {
    const ip = headers.get('cf-connecting-ip');
    if (ip != null) {
      await dao.upsertDashboard({ id: uuid, ip });
    }
  })());

  return response;
})));
