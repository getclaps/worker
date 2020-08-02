import { checkProofOfClap } from './util.js';
import { FaunaDAO } from './fauna-dao.js';
import { JSONResponse, JSONRequest } from './json-response.js';

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const basicAuth = (username = '', password = '') => `Basic ${btoa(`${username}:${password}`)}`;

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2020-03-02';
const STRIPE_HEADERS = {
  'Authorization': basicAuth(Reflect.get(self, 'STRIPE_SECRET_KEY')),
  'Stripe-Version': STRIPE_API_VERSION,
};

/**
 * @param {string} url 
 */
export const validateURL = (url) => {
  try {
    if (!url) throw new Response('No url provided', { status: 400 });
    if (url.length > 4096) throw new Response('URL too long. 4096 characters max.', { status: 400 });
    const targetURL = new URL(url)
    targetURL.search = ''
    return targetURL;
  } catch {
    throw new Response('Invalid URL. Needs to be fully qualified, e.g. https://hydejack.com', { status: 400 });
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
        console.error('err', err);
        new Response(null, { status: 500 });
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
      return new Response(null, { status: 401 });
    }

    case '/claps': {
      const dao = new FaunaDAO();
      const url = validateURL(requestURL.searchParams.get('url'));

      const reqOrigin = request.headers.get('Origin');
      if (!reqOrigin) {
        return new Response("Origin not sent", { status: 400 });
      }
      const reqHostname = new URL(reqOrigin).hostname;
      if (![url.hostname, 'localhost', '0.0.0.0'].includes(reqHostname)) {
        return new Response("Origin doesn't match", { status: 400 });
      }

      switch (request.method) {
        case 'POST': {
          const { claps, id, nonce } = await request.json();
          if (!RE_UUID.test(id)) {
            return new Response('Malformed id. Needs to be UUID', { status: 400 });
          }
          if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
            return new Response('Nonce needs to be integer between 0 and MAX_SAFE_INTEGER', { status: 400 });
          }
          if (await checkProofOfClap({ url, claps, id, nonce }) != true) {
            return new Response('Invalid nonce', { status: 400 })
          }
           
          const country = request.headers.get('cf-ipcountry');

          return dao.updateClaps({ 
            id, claps, nonce, country,
            hostname: url.hostname, 
            href: url.href, 
          });
        }

        case 'GET': {
          const url = validateURL(requestURL.searchParams.get('url'));
          return await dao.getClaps({ href: url.href });
        }

        default: return new Response(null, { status: 404 });
      }
    }

    case '/stripe/checkout-session': {
      switch (request.method) {
        case 'POST': {
          const { priceId } = await request.json();

          // curl https://api.stripe.com/v1/checkout/sessions \
          //   -u sk_test_0ISRffdXEoUxgOZDMLFFPnqI: \
          //   -d success_url="https://example.com/success" \
          //   -d cancel_url="https://example.com/cancel" \
          //   -d "payment_method_types[0]"=card \
          //   -d "line_items[0][price]"=price_H5ggYwtDq4fbrJ \
          //   -d "line_items[0][quantity]"=2 \
          //   -d mode=payment

          const formData = new URLSearchParams();
          formData.append('mode', 'subscription');
          formData.append('payment_method_types[0]', 'card');
          formData.append('line_items[0][quantity]', '1');
          formData.append('line_items[0][price]', priceId);
          formData.append('success_url', `${requestURL.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
          formData.append('cancel_url', `${requestURL.origin}/canceled.html`);
          
          const stripeRequest = new JSONRequest(new URL('/v1/checkout/sessions', STRIPE_API), {
            headers: STRIPE_HEADERS,
            method: 'POST',
            body: formData,
          });

          const stripeResponse = await fetch(stripeRequest);

          if (stripeResponse.ok) {
            const session = await stripeResponse.json();
            return new JSONResponse({ sessionId: session.id });
          } else {
            const { error } = await stripeResponse.json()
            console.error(error);
            return new Response(error.message, { status: 400 });
          }
        }

        case 'GET': {
          const sessionId = requestURL.searchParams.get('sessionId')

          // curl https://api.stripe.com/v1/checkout/sessions/cs_test_UESUpjXpxiOy72fNubOpJenKJhlOAEMQts5XFBB4l01ZJPI6hiRALfbT \
          //   -u sk_test_0ISRffdXEoUxgOZDMLFFPnqI:

          const stripeResponse = await fetch(new JSONRequest(new URL(`/v1/checkout/sessions/${sessionId}`, STRIPE_API), {
            headers: STRIPE_HEADERS,
          }));

          const session = await stripeResponse.json()

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

        default: return new Response(null, { status: 404 });
      }
    }

    // case '/stripe/webhook': {
    //   const stripe = new Stripe(Reflect.get(self, 'STRIPE_SECRET_KEY'), { apiVersion: '2020-03-02' })

    //   if (request.method !== 'POST') return new Response(null, { status: 404 });

    //   let data, eventType;
    //   // Check if webhook signing is configured.
    //   if (Reflect.get(self, 'STRIPE_WEBHOOK_SECRET')) {
    //     // Retrieve the event by verifying the signature using the raw body and secret.
    //     let event;
    //     let signature = request.headers.get('stripe-signature');

    //     try {
    //       event = stripe.webhooks.constructEvent(
    //         await request.text(),
    //         signature,
    //         Reflect.get(self, 'STRIPE_WEBHOOK_SECRET'),
    //       );
    //     } catch (err) {
    //       console.log(`⚠️  Webhook signature verification failed.`);
    //       return new Response(null, { status: 400 });
    //     }
    //     // Extract the object from the event.
    //     ({ data, type: eventType } = event);
    //   } else {
    //     // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    //     // retrieve the event data directly from the request body.
    //     ({ data, type: eventType } = await request.json());
    //   }

    //   if (eventType === "checkout.session.completed") {
    //     console.log(`🔔  Payment received!`);
    //   }

    //   return new Response(null, { status: 200 });
    // }

    default: {
      return new Response(null, { status: 404 });
    }
  }
}
