import * as re from '@werker/response-creators';
import { CloudflareStorageArea } from '@werker/cloudflare-kv-storage';

import { Awaitable } from '../../vendor/common-types';
import { withSignedCookies, withEncryptedCookies } from '../../vendor/middleware/cookies';
import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';
import { withSession } from '../../vendor/middleware';

import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { parseUUID } from '../../vendor/short-id';
import { RouteArgs, DashboardArgs, DashboardSession } from '../../router';
import { AUTH, KV } from '../../constants';

type DashboardHandler = (args: DashboardArgs) => Awaitable<Response>;

const acceptHTML = withContentNegotiation(<const>{ types: ['text/html'] });
export const dashCookies = withEncryptedCookies({ secret: AUTH });
export const dashSession = withSession<DashboardSession>({
  // storage: new CloudflareStorageArea(KV),
  cookieName: 'getclaps.dev.session',
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
  if (!id) return re.seeOther('/login');

  const uuid = parseUUID(id);
  if (!uuid) return re.seeOther('/login');

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
