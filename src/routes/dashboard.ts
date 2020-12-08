import { UUID } from 'uuid-class';
import { notFound, seeOther } from '@werker/response-creators';

import { WORKER_DOMAIN, HAS_BILLING } from '../constants';
import { DAO } from '../dao';
import { getDAO } from '../dao/get-dao';
import { elongateId, shortenId } from '../short-id';
import { mkBookmarkedCookieKey, mkLoginCookie, mkLoginsCookie, parseCookie } from './mk-cookies';

import { router, dashboardRouter } from '../router';

import './dashboard/index';

router.get('/dashboard/new', async ({ requestURL, headers }) => {
  const dao: DAO = getDAO();
  const cookies = parseCookie(headers.get('cookie') || '');

  let props: { id: UUID, [prop: string]: any };
  if (HAS_BILLING) {
    // @ts-ignore
    const { newProps } = await import(/* webpackMode: "eager" */ '../billing');
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

  return seeOther(new URL(`/settings`, WORKER_DOMAIN), {
    headers: [
      ['Set-Cookie', mkLoginCookie(shortenId(props.id))],
      ['Set-Cookie', mkLoginsCookie(cookies, shortenId(props.id))],
    ],
  });
})

router.get('/dashboard/renew', async ({ requestURL, headers }) => {
  const dao: DAO = getDAO();
  const cookies = parseCookie(headers.get('cookie') || '');

  const id = elongateId(requestURL.searchParams.get('did'));
  const dashboard = await dao.getDashboard(id);

  let props: { id: UUID, [prop: string]: any };
  if (HAS_BILLING) {
    // @ts-ignore
    const { renewProps } = await import(/* webpackMode: "eager" */ '../billing');
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
});

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
