import { UUID } from 'uuid-class';
import { badRequest, conflict, unauthorized, internalServerError, notFound, ok, paymentRequired, seeOther } from '@werker/response-creators';
import { Method } from 'tiny-request-router'

import { getDAO } from './dao/get-dao';
import { BadRequestError, ConflictError, NotFoundError, PaymentRequiredError } from './errors';

import { router } from './router';
import { DEBUG, IP_SALT_KEY, HAS_BILLING, KV } from './constants';
import { mkBookmarkedCookieKey, parseCookie } from './routes/mk-cookies';

export { DEBUG };

import './routes/index';
// @ts-ignore
if (HAS_BILLING) import(/* webpackMode: "eager" */ './billing');

function handleError(err: any) {
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof PaymentRequiredError) return paymentRequired(err.message);
  if (err instanceof ConflictError) return conflict(err.message);
  if (err instanceof BadRequestError) return badRequest(err.message);
  if (DEBUG) throw err;
  return internalServerError();
}

router.post('/__init', async ({ headers }) => {
  if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return unauthorized();
  await getDAO().init();
  return ok();
});

router.post('/__scheduled', async ({ headers }) => {
  if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return unauthorized();
  await scheduledDaily();
  return ok();
});

router.get('/', async ({ headers }) => {
  const cookies = parseCookie(headers.get('cookie') || '');

  const id = cookies.get('did');
  if (!id) return seeOther('/login');

  const isBookmarked = cookies.has(await mkBookmarkedCookieKey(id));
  if (!isBookmarked) return seeOther('/settings')

  return seeOther('/stats')
});

self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event: FetchEvent) {
  const { request } = event;
  const { headers } = request;
  const method = request.method as Method;
  const requestURL = new URL(request.url)
  const { pathname } = requestURL;

  const match = router.match(method, pathname);
  if (match) {
    const args = {
      method, request, requestURL, event, pathname, headers, 
      params: match.params,
    };
    try {
      return match.handler(args);
    } catch (err) {
      return handleError(err);
    }
  }
  return notFound();
}

async function resetIPSalt() {
  await KV.put(IP_SALT_KEY, UUID.v4().toString());
}

async function scheduledDaily() {
  try { await resetIPSalt() } catch (e) { console.error(e) }
  if (HAS_BILLING) {
    // @ts-ignore
    const { checkSubscriptionStatus, checkUsage } = await import(/* webpackMode: "eager" */ './billing');
    try { await checkSubscriptionStatus() } catch (e) { console.error(e) }
    try { await checkUsage() } catch (e) { console.error(e) }
  }
}

self.addEventListener('scheduled', (e: ScheduledEvent) => {
  e.waitUntil((async () => {
    const scheduledDate = new Date(e.scheduledTime);
    if (scheduledDate.getUTCMinutes() === 0 && scheduledDate.getUTCHours() === 0) {
      await scheduledDaily();
    }
  })());
});
