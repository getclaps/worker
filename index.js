import { checkProofOfClap } from './util.js';
import { FaunaDAO } from './fauna-dao.js';
import { JSONResponse, JSONRequest, urlWithParams } from './json-response.js';
import { constructEvent } from './webhook.js';
import { elongateId, shortenId } from './short-id';
import { UUID } from 'uuid-class/mjs';
import { ok, badRequest, forbidden, notFound, redirect } from './response-types';

const MY_NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef'

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const basicAuth = (username = '', password = '') => `Basic ${btoa(`${username}:${password}`)}`;


const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2020-03-02';

const ORIGIN = 'http://localhost:8787';
const DASHBOARD_ORIGIN = 'http://localhost:3000';

const RE_ENTRY = /\/dashboard\/?/;
const RE_DASHBOARD_ID = /\/dashboard\/([0-9A-Za-z-_]{22})\/?/;
const RE_DASHBOARD_DOMAIN = /\/dashboard\/([0-9A-Za-z-_]{22})\/domain\/?/;

/**
 * @param {string} endpoint 
 * @param {{ method?: string, body?: any, headers?: object }=} params 
 */
async function stripeAPI(endpoint, { headers, ...params } = {}) {
  const stripeResponse = await fetch(new JSONRequest(new URL(endpoint, STRIPE_API), {
    headers: {
      ...headers,
      'Authorization': basicAuth(Reflect.get(self, 'STRIPE_SECRET_KEY')),
      'Stripe-Version': STRIPE_API_VERSION,
    },
    ...params,
  }));

  if (!stripeResponse.ok) {
    const { error } = await stripeResponse.json();
    console.error(error);
    throw badRequest(error.message);
  }

  return await stripeResponse.json();
}

/**
 * @param {string} url 
 */
export const validateURL = (url) => {
  try {
    if (!url) throw badRequest('No url provided')
    if (url.length > 4096) throw badRequest('URL too long. 4096 characters max.');
    const targetURL = new URL(url)
    targetURL.search = ''
    return targetURL;
  } catch {
    throw badRequest('Invalid URL. Needs to be fully qualified, e.g. https://hydejack.com');
  }
}

/**
 * @param {Response} r 
 */
const addCORSHeaders = (r) => {
  r.headers.set('Access-Control-Allow-Origin', '*');
  r.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma, Authorization');
  return r;
}

self.addEventListener('fetch', /** @param {FetchEvent} event */ event => {
  event.respondWith(
    handleRequest(event.request, new URL(event.request.url))
      .catch(err => {
        if (err instanceof Response) return err;
        console.error('err', err.message);
        return new Response(null, { status: 500 });
      })
      .then(addCORSHeaders)
  );
});

/**
 * @param {Request} request
 * @param {URL} requestURL
 * @returns {Promise<Response>}
 */
async function handleRequest(request, requestURL) {
  const { method, headers } = request;

  if (method === 'OPTIONS') return new Response();

  switch (requestURL.pathname) {
    case '/__init': {
      const dao = new FaunaDAO();
      if (headers.get('Authorization') !== Reflect.get(self, 'AUTH')) return forbidden();
      return await dao.init()
    }

    case '/claps': {
      const dao = new FaunaDAO();
      const url = validateURL(requestURL.searchParams.get('url'));

      const reqOrigin = headers.get('Origin');
      if (!reqOrigin) return badRequest('Origin not sent');

      const reqHostname = new URL(reqOrigin).hostname;
      if (![url.hostname, 'localhost', '0.0.0.0'].includes(reqHostname)) {
        return badRequest("Origin doesn't match");
      }

      switch (method) {
        case 'POST': {
          const { claps, id, nonce } = await request.json();
          if (!RE_UUID.test(id)) {
            return badRequest('Malformed id. Needs to be UUID');
          }
          if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
            return badRequest('Nonce needs to be integer between 0 and MAX_SAFE_INTEGER');
          }
          if (await checkProofOfClap({ url, claps, id, nonce }) != true) {
            return badRequest('Invalid nonce');
          }

          const country = headers.get('cf-ipcountry');

          return dao.updateClaps({
            claps, nonce, country,
            id: new UUID(id).buffer,
            hostname: requestURL.hostname,
            href: url.href,
            hash: url.hash,
          });
        }

        case 'GET': {
          const url = validateURL(requestURL.searchParams.get('url'));
          return await dao.getClaps({ 
            hostname: requestURL.hostname,
            href: url.href,
          });
        }

        default: return notFound();
      }
    }

    case '/stripe/checkout-session': {
      switch (method) {
        case 'POST': {
          const { priceId } = await request.json();

          const formData = new URLSearchParams();
          formData.append('mode', 'subscription');
          formData.append('payment_method_types[0]', 'card');
          formData.append('line_items[0][quantity]', '1');
          formData.append('line_items[0][price]', priceId);
          formData.append('success_url', new URL('/thank-you/?session_id={CHECKOUT_SESSION_ID}', requestURL.origin).href);
          formData.append('cancel_url', new URL('/', requestURL.origin).href);

          const session = await stripeAPI('/v1/checkout/sessions')
          return new JSONResponse({ sessionId: session.id });
        }

        case 'GET': {
          const sessionId = requestURL.searchParams.get('sessionId')
          const session = await stripeAPI(`/v1/checkout/sessions/${sessionId}`);
          return new JSONResponse(session);
        }

        default: return new Response(null, { status: 404 });
      }
    }

    case '/stripe/setup': {
      switch (method) {
        case 'GET': {
          return new JSONResponse({
            publishableKey: Reflect.get(self, 'STRIPE_PUBLISHABLE_KEY'),
            priceId: Reflect.get(self, 'STRIPE_PRICE_ID'),
          })
        }

        default: return notFound();
      }
    }

    case '/stripe/webhook': {
      if (method !== 'POST') return notFound();

      let data, eventType;
      // Check if webhook signing is configured.
      if (Reflect.get(self, 'STRIPE_WEBHOOK_SECRET')) {
        // Retrieve the event by verifying the signature using the raw body and secret.
        let event;
        let signature = headers.get('stripe-signature');

        try {
          event = await constructEvent(
            await request.text(),
            signature,
            Reflect.get(self, 'STRIPE_WEBHOOK_SECRET'),
          );
        } catch (err) {
          console.log(`⚠️  Webhook signature verification failed.`);
          return badRequest();
        }
        // Extract the object from the event.
        ({ data, type: eventType } = event);
      } else {
        // Webhook signing is recommended, but if the secret is not configured in `config.js`,
        // retrieve the event data directly from the request body.
        ({ data, type: eventType } = await request.json());
      }

      console.log(eventType, data);
      if (eventType === "checkout.session.completed") {
        console.log(`🔔  Payment received!`);
      }

      return ok();
    }

    default: {
      let match;
      if (match = requestURL.pathname.match(/\/stripe\/forward\/?/)) {
        if (method !== 'POST') return notFound();

        const formData = await request.formData();

        // @ts-ignore
        const body = new URLSearchParams([...formData].filter(([, v]) => typeof v === 'string'));

        const psk = Reflect.get(self, 'STRIPE_PUBLISHABLE_KEY');
        const session = await stripeAPI('/v1/checkout/sessions', { method: 'POST', body });

        return new Response(`
<!DOCTYPE html>
<html>
  <head>
    <title>Redirecting</title>
  </head>
  <body>
    <p>Taking you to Stripe Checkout...</p>
    <script src="https://js.stripe.com/v3/"></script>
    <script>
      var stripe = Stripe('${psk}');
      stripe.redirectToCheckout({ sessionId: '${session.id}' });
    </script>
  </body>
</html>
      `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

        // const res = await fetch('http://localhost:4002/stripe/');
        // return new HTMLRewriter()
        //   .on('*#session-id', new class {
        //     element(element) { element.setInnerContent(session.id) }
        //   })
        //   .transform(res);
      }
      else if (match = requestURL.pathname.match(RE_DASHBOARD_DOMAIN)) {
        if (method !== 'POST') return notFound();

        const uuid = elongateId(match[1]);
        const fd = await request.formData();
        // @ts-ignore
        const hostnameURL = new URL(fd.get('hostname'));
        await new FaunaDAO().updateDomain(uuid.buffer, hostnameURL.hostname);
        return redirect(new URL(`/dashboard/${match[1]}`, ORIGIN));
      }
      else if (match = requestURL.pathname.match(RE_DASHBOARD_ID)) {
        if (method !== 'GET') return notFound();

        const uuid = elongateId(match[1]);
        const dashboard = await new FaunaDAO().getDashboard(uuid.buffer);

        return new Response(`
<!DOCTYPE html>
<html>
  <head>
    <title>Clap Button Dashboard</title>
  </head>
  <body>
    <p>You current domain is: <strong>${dashboard.hostname}</strong></p>
    <form method="POST" action="/dashboard/${match[1]}/domain">
      <input type="url" name="hostname" placeholder="https://example.com" value="https://" required/>
      <button type="submit">Add domain</button>
    </form>
  </body>
</html>
      `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }
      else if (match = requestURL.pathname.match(RE_ENTRY)) {
        if (method !== 'GET') return notFound();

        const sessionId = requestURL.searchParams.get('session_id');
        if (!sessionId) return notFound();

        const data = await stripeAPI(`/v1/checkout/sessions/${sessionId}`);
        const { customer, subscription } = data;
        // const subscription = await stripeAPI(`/v1/subscriptions/${session.subscription}`);

        if (!subscription || !customer) return badRequest();

        const id = await UUID.v5(sessionId, MY_NAMESPACE);

        await new FaunaDAO().upsertDashboard({
          id: id.buffer,
          customer,
          subscription,
          active: true,
        });

        return redirect(new URL(`/dashboard/${shortenId(id)}`, ORIGIN));
        // return redirect(urlWithParams('/', { 'dashboard_id': shortenId(id) }, DASHBOARD_ORIGIN));
      }
      return notFound();
    }
  }
}
