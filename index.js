import { checkProofOfClap } from './util.js';
import { FaunaDAO } from './fauna-dao.js';
import { JSONResponse, JSONRequest } from './json-response.js';
import { constructEvent } from './webhook.js';

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const basicAuth = (username = '', password = '') => `Basic ${btoa(`${username}:${password}`)}`;

const ok = (msg = null) => new Response(msg, { status: 200 });
const badRequest = (msg = null) => new Response(msg, { status: 400 });
const forbidden = (msg = null) => new Response(msg, { status: 401 });
const notFound = (msg = null) => new Response(msg, { status: 404 });

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2020-03-02';

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
  if (request.method === 'OPTIONS') return new Response();

  switch (requestURL.pathname) {
    case '/__init': {
      const dao = new FaunaDAO();
      if (request.headers.get('Authorization') === Reflect.get(self, 'AUTH')) {
        return await dao.init()
      }
      return forbidden();
    }

    case '/claps': {
      const dao = new FaunaDAO();
      const url = validateURL(requestURL.searchParams.get('url'));

      const reqOrigin = request.headers.get('Origin');
      if (!reqOrigin) {
        return badRequest('Origin not sent');
      }
      const reqHostname = new URL(reqOrigin).hostname;
      if (![url.hostname, 'localhost', '0.0.0.0'].includes(reqHostname)) {
        return badRequest("Origin doesn't match");
      }

      switch (request.method) {
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

          const country = request.headers.get('cf-ipcountry');

          return dao.updateClaps({
            id, claps, nonce, country,
            hostname: url.hostname,
            href: url.href,
            hash: url.hash,
          });
        }

        case 'GET': {
          const url = validateURL(requestURL.searchParams.get('url'));
          return await dao.getClaps({ href: url.href });
        }

        default: return notFound();
      }
    }

    case '/stripe/checkout-session': {
      switch (request.method) {
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
      switch (request.method) {
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
      if (request.method !== 'POST') return notFound();

      let data, eventType;
      // Check if webhook signing is configured.
      if (Reflect.get(self, 'STRIPE_WEBHOOK_SECRET')) {
        // Retrieve the event by verifying the signature using the raw body and secret.
        let event;
        let signature = request.headers.get('stripe-signature');

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

    case '/stripe/forward': {
      if (request.method !== 'POST') return notFound();

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
    default: {
      return notFound();
    }
  }
}
