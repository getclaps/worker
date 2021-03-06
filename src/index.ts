import * as re from '@worker-tools/response-creators';
import { UUID } from 'uuid-class';
import { Method } from 'tiny-request-router'

// import { RequestCookieStore } from './vendor/middleware/cookies';

import { IP_SALT_KEY, storage } from './constants';
import { router } from './router';
import { dashSession, dashCookies } from './routes/dashboard/with-dashboard';

import './routes/index';

// IMPLEMENT THIS FUNCTION WHEN USING THE OPEN SOURCE VERSION!
import { getDAO } from './dao/get-dao';

// REMOVE THIS LINE WHEN USING THE OPEN SOURCE VERSION!
import './billing/index';

async function resetIPSalt() {
  await storage.set(IP_SALT_KEY, new UUID());
}

// router.get('/__test', async ({ request }) => {
//   const cookieStore = new RequestCookieStore(request);
//   await cookieStore.set('foo', 'bar');
//   await cookieStore.set('fizz', 'buzz');
//   const response = new Response(null, cookieStore);
//   console.log(JSON.stringify([...response.headers]))
//   return response;
// });

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

router.get('/', dashCookies(dashSession(async ({ session }) => {
  const cid = session.cid;
  if (!cid) return re.seeOther('/login');

  const isBookmarked = session.bookmarked.has(cid);
  if (!isBookmarked) return re.seeOther('/settings');

  return re.seeOther('/stats')
})));

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
