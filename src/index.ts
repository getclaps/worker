import * as re from '@werker/response-creators';
import { UUID } from 'uuid-class';
import { Method } from 'tiny-request-router'

import { AUTH, DEBUG, IP_SALT_KEY, KV } from './constants';
import { getDAO } from './dao/get-dao';
import { router } from './router';
import { resolveOrNull } from './util';
import * as cc from './routes/cookies';
import { withCookies } from './routes/session';

import './routes/index';
// @ts-ignore
resolveOrNull(import(/* webpackMode: "eager" */ './billing')); 

async function resetIPSalt() {
  await KV.put(IP_SALT_KEY, new UUID().id);
}

router.get('/__init', async ({ headers }) => {
  if (headers.get('Authorization') !== AUTH) return re.unauthorized();
  await resetIPSalt();
  await getDAO().init();
  return re.ok('Init success');
});

router.get('/', withCookies(async ({ cookies }) => {
  const id = cookies.get('did');
  if (!id) return re.seeOther('/login');

  const isBookmarked = cookies.has(await cc.mkBookmarkedCookieKey(id));
  if (!isBookmarked) return re.seeOther('/settings')

  return re.seeOther('/stats')
}));

async function handleRequest(event: FetchEvent) {
  const { request } = event;
  const { headers } = request;
  const method = request.method as Method;
  const requestURL = new URL(request.url)
  const { pathname, searchParams } = requestURL;

  const match = router.match(method, pathname);
  if (match) {
    const args = { method, request, requestURL, searchParams, event, pathname, headers, params: match.params };
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
