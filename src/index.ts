import { UUID } from 'uuid-class';
import { badRequest, conflict, unauthorized, internalServerError, notFound, ok, paymentRequired, seeOther } from '@werker/response-creators';
import { Method } from 'tiny-request-router'

import { getDAO } from './dao/get-dao';
import { BadRequestError, ConflictError, NotFoundError, PaymentRequiredError } from './errors';

import { AUTH, DEBUG, IP_SALT_KEY, KV } from './constants';
import { router } from './router';
import { mkBookmarkedCookieKey, parseCookie } from './routes/mk-cookies';
import { resolveOrNull } from './util';

import './routes/index';
// @ts-ignore
resolveOrNull(import(/* webpackMode: "eager" */ './billing')); 

router.post('/__init', async ({ headers }) => {
  if (headers.get('Authorization') !== AUTH) return unauthorized();
  await getDAO().init();
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

function handleError(err: any) {
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof PaymentRequiredError) return paymentRequired(err.message);
  if (err instanceof ConflictError) return conflict(err.message);
  if (err instanceof BadRequestError) return badRequest(err.message);
  if (DEBUG) throw err;
  return internalServerError();
}

async function handleRequest(event: FetchEvent) {
  const { request } = event;
  const { headers } = request;
  const method = request.method as Method;
  const requestURL = new URL(request.url)
  const { pathname } = requestURL;

  const match = router.match(method, pathname);
  if (match) {
    const args = { method, request, requestURL, event, pathname, headers, params: match.params };
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
