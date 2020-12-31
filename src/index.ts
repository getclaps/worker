import * as re from '@werker/response-creators';
import { UUID } from 'uuid-class';
import { Method } from 'tiny-request-router'

import { withSignedCookies } from './vendor/middleware/cookie-store';

import { AUTH, DEBUG, IP_SALT_KEY, storage } from './constants';
import { getDAO } from './dao/get-dao';
import { router } from './router';
import { resolveOrNull } from './util';
import * as cc from './routes/cookies';

import './routes/index';
// @ts-ignore
resolveOrNull(import(/* webpackMode: "eager" */ './billing')); 

async function resetIPSalt() {
  await storage.set(IP_SALT_KEY, new UUID());
}

router.get('/__init', async ({ headers }) => {
  if (headers.get('Authorization') !== AUTH) return re.unauthorized();
  await resetIPSalt();
  await getDAO().init();
  return re.ok('Init success');
});

router.get('/__resetIPSalt', async ({ headers }) => {
  if (headers.get('Authorization') !== AUTH) return re.unauthorized();
  await resetIPSalt();
  return re.ok('Reset success');
});

router.get('/', withSignedCookies({ secret: 'foobar' })(async ({ cookies }) => {
  const id = cookies.get('did');
  if (!id) return re.seeOther('/login');

  const isBookmarked = cookies.has(await cc.bookmarkedCookieKey(id))
  if (!isBookmarked) return re.seeOther('/settings')

  return re.seeOther('/stats')
}));

async function handleRequest(event: FetchEvent) {
  const { request } = event;
  const { headers } = request;
  const method = <Method>request.method;
  const url = new URL(request.url)
  const { pathname, searchParams } = url;

  const match = router.match(method, pathname);
  if (match) {
    const args = {
      method, request, url, searchParams, event, pathname, headers, 
      params: match.params,
      matches: match.matches,
    };
    try {
      return match.handler(args);
    } catch (err) {
      return re.internalServerError(err.message);
    }
  }
  return re.notFound();
}

async function handleScheduled(scheduledDate: Date) {
  if (scheduledDate.getUTCMinutes() === 0 && scheduledDate.getUTCHours() === 0) {
    try { await resetIPSalt() } catch (e) { console.error(e) }
  }
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

self.addEventListener('scheduled', (event) => {
  event.waitUntil(handleScheduled(new Date(event.scheduledTime)));
});

export { DEBUG };
