import { UUID } from 'uuid-class/mjs';

import { FaunaDAO } from '../fauna-dao.js';
import { elongateId, shortenId } from '../short-id';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';
import { stripeAPI } from './stripe.js';

const ORIGIN = 'http://localhost:8787';
const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

export const styles = `
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif }
  main { max-width: 768px; margin: auto; }
  a { color: rgb(79,177,186) }
  @media screen and (prefers-color-scheme: dark) {
    html { color: #ccc; background: #282f31; }
  }
`;

/**
 * @param {{
 * request: Request,
 * requestURL: URL,
 * headers: Headers,
 * method: string,
 * pathname: string,
 * path: string[],
 * }} param0 
 */
export async function handleDashboard({ request, requestURL, method, pathname, headers }) {
  let match;
  if (match = pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/relocate\/?/)) {
    if (method !== 'POST') return notFound();
    if (!headers.get('content-type').includes('application/x-www-form-urlencoded')) return badRequest();

    const oldUUID = elongateId(match[1]);
    const newUUID = UUID.v4();
    const { subscription } = await new FaunaDAO().relocateDashboard(oldUUID.buffer, newUUID.buffer);
    await stripeAPI(`/v1/subscriptions/${subscription}`, {
      method: 'POST',
      data: { 'metadata[dashboard_id]': shortenId(newUUID) },
    })
    return redirect(new URL(`/dashboard/${shortenId(newUUID)}`, ORIGIN));
  }
  else if (match = pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/cancel\/?/)) {
    if (method !== 'POST') return notFound();
    if (!headers.get('content-type').includes('application/x-www-form-urlencoded')) return badRequest();
    const uuid = elongateId(match[1]);
    const dashboard = await new FaunaDAO().getDashboard(uuid.buffer);
    const fd = await request.formData();

    await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`, {
      method: 'POST',
      data: { 'cancel_at_period_end': fd.get('undo') ? 'false' : 'true' },
    });

    return redirect(new URL(`/dashboard/${match[1]}`, ORIGIN));
  }
  else if (match = pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/domain\/?/)) {
    if (method !== 'POST') return notFound();
    if (!headers.get('content-type').includes('application/x-www-form-urlencoded')) return badRequest();

    const uuid = elongateId(match[1]);
    const fd = await request.formData();
    // @ts-ignore
    await new FaunaDAO().updateDomain(uuid.buffer, new URL(fd.get('hostname')).hostname);
    return redirect(new URL(`/dashboard/${match[1]}`, ORIGIN));
  }
  else if (match = pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/?/)) {
    if (method !== 'GET') return notFound();
    if (!headers.get('accept').includes('text/html')) return badRequest();

    const uuid = elongateId(match[1]);
    const dashboard = await new FaunaDAO().getDashboard(uuid.buffer);

    const subscription = await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`);
    const { data: invoices } = await stripeAPI(`/v1/invoices`, { data: { subscription: dashboard.subscription } })

    const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));
    const time = (ts) => `<time datetime="${new Date(ts * 1000).toISOString()}">${new Intl.DateTimeFormat(locale).format(new Date(ts * 1000))}</time>`;

    return new Response(`
<!DOCTYPE html>
<html>
  <head>
    <title>Clap Button Dashboard</title>
    <style>
      html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif }
      main { max-width: 768px; margin: auto; }
      a { color: rgb(79,177,186) }
      @media screen and (prefers-color-scheme: dark) {
        html { color: #ccc; background: #282f31; }
      }
    </style>
  </head>
  <body>
    <main>
      <h3>Domain</h3>
      <p>You current domain is: <strong>${dashboard.hostname}</strong></p>
      <form method="POST" action="/dashboard/${match[1]}/domain">
        <input type="url" name="hostname" placeholder="https://example.com" value="https://" required/>
        <button type="submit">Set domain</button>
      </form>

      <h3>Key</h3>
      <p>You current dashboard key is: <strong><code>${match[1]}</code></strong></p>
      <form method="POST" action="/dashboard/${match[1]}/relocate">
        <p><small>If you've accidentally published your dashboard key, you can invalidate it by <em>relocating</em> this dashboard to a new URL:</small></p>
        <button type="submit">Relocate Dashboard</button>
        <p>
          <input type="checkbox" id="okay" name="okay" required>
          <label for="okay">I understand that the old URL will be inaccessible after relocate this dashboard</label>
        </p>
      </form>

      <h3>Invoices</h3>
      <table>
        <thead>
          <tr>
            <td>Number</td>
            <td>Created</td>
            <td>Download</td>
            <td>Status</td>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(invoice => `<tr>
            <td><a href="${invoice.hosted_invoice_url}">#${Number(invoice.number.split('-')[1])}</td>
            <td>${time(invoice.created)}</td>
            <td><a href="${invoice.invoice_pdf}">PDF</a></td>
            <td><small>${invoice.status.toUpperCase()}</small></td>
          </tr>`)}
        </tbody>
      </table>

      <h3>Subscription</h3>
      <p>
        <small>${subscription.status.toUpperCase()}</small>
        ${subscription.cancel_at_period_end 
          ? `<small>(Will be cancelled on ${time(subscription.current_period_end)})</small>` 
          : `<small>(Next billing period starts on ${time(subscription.current_period_end)})</small>)`
        }
      </p>
      ${subscription.cancel_at_period_end
          ? subscription.status === 'active' 
            ? `
              <form method="POST" action="/dashboard/${match[1]}/cancel">
                <button type="submit">Instant Renew Subscription</button>
                <input type="hidden" name="undo" value="true">
              </form>`
            : `<p>TODO: Implement renew subscription</p>`
          : `
          <form method="POST" action="/dashboard/${match[1]}/cancel">
            <button type="submit">Cancel Subscription</button>
            <p>
              <input type="checkbox" id="cancel-okay" name="okay" required>
              <label for="cancel-okay">I understand that all embedded clap buttons will stop working at the end of the current billing period.</label>
            </p>
          </form>`
        }
    </main>
  </body>
</html>
      `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }
  else if (match = pathname.match(/\/dashboard\/?/)) {
    if (method !== 'GET') return notFound();

    const sessionId = requestURL.searchParams.get('session_id');
    if (!sessionId) return notFound();

    const { customer, subscription } = await stripeAPI(`/v1/checkout/sessions/${sessionId}`);

    if (!subscription || !customer) return badRequest();

    const id = await UUID.v5(sessionId, NAMESPACE);

    await stripeAPI(`/v1/subscriptions/${subscription}`, {
      method: 'POST',
      data: { 'metadata[dashboard_id]': shortenId(id) },
    });

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