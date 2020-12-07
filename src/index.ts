import { UUID } from 'uuid-class';
import { badRequest, conflict, unauthorized, internalServerError, notFound, ok, paymentRequired, methodNotAllowed } from '@werker/response-creators';

import { getDAO } from './dao/get-dao';
import * as routes from './routes/index';
import { BadRequestError, ConflictError, NotFoundError, PaymentRequiredError } from './errors';

import { DEBUG, KV_NAMESPACE, IP_SALT_KEY, HAS_BILLING } from './constants';

export { DEBUG };

const getPath = (pathname: string) => {
  const x = `/${pathname}/`.replace(/\/+/g, '/');
  return x.substr(1, x.length - 2).split('/');
}

const addCORSHeaders = (request: Request) => (response: Response) => {
  response.headers.set('access-control-allow-origin', request.headers.get('origin'));
  if (request.headers.has('access-control-request-method')) response.headers.set('access-control-allow-methods', request.headers.get('access-control-request-method'));
  if (request.headers.has('access-control-request-headers')) response.headers.set('access-control-allow-headers', request.headers.get('access-control-request-headers'));
  response.headers.set('access-control-allow-credentials', 'true');
  return response;
}

function handleError(err: any) {
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof PaymentRequiredError) return paymentRequired(err.message);
  if (err instanceof ConflictError) return conflict(err.message);
  if (err instanceof BadRequestError) return badRequest(err.message);
  if (DEBUG) throw err;
  return internalServerError();
}

self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request, new URL(event.request.url), event));
});

export interface RouteArgs {
  request: Request;
  requestURL: URL;
  event: FetchEvent;
  headers: Headers;
  method: string;
  pathname: string;
  path: string[];
}

async function handleRequest(request: Request, requestURL: URL, event: FetchEvent) {
  const { method, headers } = request;
  const { pathname } = requestURL;

  const path = getPath(pathname);

  const args: RouteArgs = { request, requestURL, event, method, pathname, path, headers };

  switch (path[0]) {
    case '__init': {
      if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return unauthorized();
      if (method === 'POST') return getDAO().init().then(() => ok()).catch(handleError);
      return methodNotAllowed();
    }
    case '__scheduled': {
      if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return unauthorized();
      if (method === 'POST') return scheduledDaily().then(() => ok()).catch(handleError)
      return methodNotAllowed();
    }
    case 'claps': {
      return routes.handleClaps(args).catch(handleError).then(addCORSHeaders(request));
    }
    case 'views': {
      return routes.handleViews(args).catch(handleError).then(addCORSHeaders(request));
    }
    case 'dashboard': {
      return routes.handleDashboard(args).catch(handleError);
    }
    case 'stripe': {
      if (!HAS_BILLING) return notFound();
      const { handleStripe } = await import(/* webpackMode: "eager" */ './billing/stripe');
      return handleStripe(args).catch(handleError);
    }
   default: {
      args.path = ['dashboard', ...path];
      return routes.handleDashboard(args).catch(handleError);
    }
  }
}

async function resetIPSalt() {
  const kv = Reflect.get(self, KV_NAMESPACE) as KVNamespace;
  await kv.put(IP_SALT_KEY, UUID.v4().toString());
}

async function scheduledDaily() {
  try { await resetIPSalt() } catch (e) { console.error(e) }
  if (HAS_BILLING) {
    const { checkSubscriptionStatus, checkUsage } = await import(/* webpackMode: "eager" */ './billing/re-new');
    try { await checkSubscriptionStatus() } catch (e) { console.error(e) }
    try { await checkUsage() } catch (e) { console.error(e) }
  }
}

self.addEventListener('scheduled', (e: ScheduledEvent) => {
  e.waitUntil((async () => {
    const scheduledDate = new Date(e.scheduledTime);
    if (scheduledDate.getUTCMinutes() === 0 && scheduledDate.getUTCHours() === 0) {
      await scheduledDaily();
      // if (scheduledDate.getUTCDay() === 0) {
      //   // await resetUsage();
      // }
    }
  })());
});
