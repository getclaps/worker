import * as re from '@werker/response-creators';

import { Awaitable } from '../../vendor/common-types';
import { withCookies, withEncryptedCookies } from '../../vendor/middleware/cookies';
import { withContentNegotiation } from '../../vendor/middleware/content-negotiation';
import { withCookieSession } from '../../vendor/middleware';
import * as mime from '../../vendor/middleware/mime';

import { getDAO } from '../../dao/get-dao';
import { parseUUID } from '../../vendor/short-id';
import { RouteArgs, DashboardArgs, DashboardSession } from '../../router';
import { AUTH, storage } from '../../constants';
import { dntCookieKey } from '../cookies';

type DashboardHandler = (args: DashboardArgs) => Awaitable<Response>;

const html = withContentNegotiation(<const>{ types: [mime.HTML] });
const cookies = withCookies();

export const dashCookies = withEncryptedCookies({ secret: AUTH });
export const dashSession = withCookieSession<DashboardSession>({
  cookieName: 'getclaps.session',
  defaultSession: {
    ids: [],
    bookmarked: new Set(),
    hostnames: new Map()
  },
  expirationTtl: 60 * 60 * 24 * 365,
});

export const withDashboard = (handler: DashboardHandler) => html<RouteArgs>(cookies(dashCookies(dashSession(async (args): Promise<Response> => {
  const { headers, event, session, cookies } = args;

  const dao = getDAO();

  const id = session.cid;
  if (!id) return re.seeOther('/login');

  const uuid = parseUUID(id);
  if (!uuid) return re.seeOther('/login');

  const isBookmarked = session.bookmarked.has(id);

  const [locale] = args.language?.split('-') ?? ['en'];

  const response = await handler({ ...args, locale, id, uuid, session, dao, isBookmarked });

  const ip = headers.get('cf-connecting-ip');
  const hns = session.ids.map(id => session.hostnames.get(id));
  if (ip) {
    event.waitUntil(hns.map(hn => {
      if (!hn) return;
      const dnt = cookies.has(dntCookieKey(hn));
      return storage.set(hn, dnt ? [ip] : []);
    }));
  }

  return response;
}))));
