import { UUID } from 'uuid-class/mjs';

import { FaunaDAO } from '../fauna-dao.js';
import { elongateId, shortenId } from '../short-id';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';
import { stripeAPI } from './stripe.js';


const RE_DASHBOARD = /\/dashboard\/?/;
const RE_DASHBOARD_ID = /\/dashboard\/([0-9A-Za-z-_]{22})\/?/;
const RE_DASHBOARD_DOMAIN = /\/dashboard\/([0-9A-Za-z-_]{22})\/domain\/?/;
const RE_DASHBOARD_RELOCATE = /\/dashboard\/([0-9A-Za-z-_]{22})\/relocate\/?/;

const ORIGIN = 'http://localhost:8787';
const MY_NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef'

/**
 * @param {{
 * request: Request,
 * requestURL: URL,
 * headers: Headers,
 * method: string,
 * pathname: string,
 * }} param0 
 */
export async function handleDashboard({ request, requestURL, method, pathname, headers }) {
  let match;
  if (match = pathname.match(RE_DASHBOARD_RELOCATE)) {
    if (method !== 'POST') return notFound();

    const oldUUID = elongateId(match[1]);
    const newUUID = UUID.v4();
    await new FaunaDAO().relocateDashboard(oldUUID.buffer, newUUID.buffer);
    return redirect(new URL(`/dashboard/${shortenId(newUUID)}`, ORIGIN));
  }
  else if (match = pathname.match(RE_DASHBOARD_DOMAIN)) {
    if (method !== 'POST') return notFound();

    const uuid = elongateId(match[1]);
    const fd = await request.formData();
    // @ts-ignore
    const hostnameURL = new URL(fd.get('hostname'));
    await new FaunaDAO().updateDomain(uuid.buffer, hostnameURL.hostname);
    return redirect(new URL(`/dashboard/${match[1]}`, ORIGIN));
  }
  else if (match = pathname.match(RE_DASHBOARD_ID)) {
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
    <hr/>
    <p>You current dashboard key is: <strong><code>${match[1]}</code></strong></p>
    <form method="POST" action="/dashboard/${match[1]}/relocate">
      <p><small>If you've accidentally published your dashboard key, you can invalidate it by <em>relocating</em> this dashboard to a new URL:</small></p>
      <button type="submit">Relocate Dashboard</button>
      <div>
        <input type="checkbox" id="okay" name="okay" required>
        <label for="okay">I understand that the old URL will be inaccessible after relocate this dashboard</label>
      </div>
    </form>
  </body>
</html>
      `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }
  else if (match = pathname.match(RE_DASHBOARD)) {
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
}