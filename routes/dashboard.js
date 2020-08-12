import { UUID } from 'uuid-class/mjs';

import { FaunaDAO } from '../fauna-dao.js';
import { elongateId, shortenId } from '../short-id';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';
import { stripeAPI } from './stripe.js';

const WORKER_DOMAIN = 'http://localhost:8787';
const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

export const styles = `
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif }
  main { max-width: 768px; margin: auto; }
  a { color: rgb(79,177,186) }
  @media screen and (prefers-color-scheme: dark) {
    html { color: #ccc; background: #282f31; }
  }
`;

const page = ({ id, title = 'Clap Button Dashboard' }) => (content) => new Response(`
<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>
    <main>
      <nav class="bp3-tabs">
        <ul class="bp3-tab-list" role="tablist">
          <li class="bp3-tab" role="tab"><a href="/dashboard/${id}/setup">Setup</a></li>
          <li class="bp3-tab" role="tab"><a href="/dashboard/${id}/subscription">Subscription</a></li>
          <li class="bp3-tab" role="tab"><a href="/dashboard/${id}/invoices">Invoices</a></li>
          <li class="bp3-tab" role="tab"><a href="/dashboard/${id}/stats">Stats</a></li>
        </ul>
      </nav>
      ${content}
    </main>
  </body>
</html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })

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
  const dao = new FaunaDAO();

  let match;
  if (match = pathname.match(/\/new-dashboard\/?/)) {
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

    await dao.upsertDashboard({
      id: id.buffer,
      customer,
      subscription,
      active: true,
    });

    return redirect(new URL(`/dashboard/${shortenId(id)}`, WORKER_DOMAIN));
  }
  else if (match = pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/?/)) {
    if (!headers.get('accept').includes('text/html')) return badRequest();

    let id = match[1];
    let uuid = elongateId(id);
    let dashboard = await dao.getDashboard(uuid.buffer);
    let error = false;

    if (pathname.match(/\/setup\/?$/)) {
      if (method === 'POST') {
        const fd = await request.formData();
        switch (fd.get('method')) {
          case 'domain': {
            try {
              // @ts-ignore
              dashboard = await dao.updateDomain(uuid.buffer, new URL(fd.get('hostname')).hostname);
            } catch (err) {
              if (err instanceof Response && err.status === 400) {
                error = true;
              } else throw err;
            }
            break;
          }
          case 'relocate': {
            const oldUUID = elongateId(match[1]);
            const newUUID = UUID.v4();
            const { subscription } = await dao.relocateDashboard(oldUUID.buffer, newUUID.buffer);
            const newId = shortenId(newUUID);
            await stripeAPI(`/v1/subscriptions/${subscription}`, {
              method: 'POST',
              data: { 'metadata[dashboard_id]': shortenId(newUUID) },
            });
            return redirect(new URL(`/dashboard/${newId}/key`, WORKER_DOMAIN));
          }
          default: return badRequest();
        }
      } else if (method === 'GET') { } else return badRequest();
      return page({ id })(`
        <h3>Domain</h3>
        <p>You current domain is: <strong>${dashboard.hostname}</strong></p>
        <form method="POST" action="/dashboard/${id}/domain">
          <input type="url" name="hostname" placeholder="https://example.com" value="https://" required/>
          <input type="hidden" name="method" value="domain"/>
          <button type="submit">Set domain</button>
          ${error ? `<div>Someone is already using that domain!</div>` : ''}
        </form>

        <h3>Key</h3>
        <p>You current dashboard key is: <strong><code>${id}</code></strong></p>
        <form method="POST" action="/dashboard/${id}/key">
          <p><small>If you've accidentally published your dashboard key, you can invalidate it by <em>relocating</em> this dashboard to a new URL:</small></p>
          <button type="submit">Relocate Dashboard</button>
          <p>
            <input type="checkbox" id="okay" name="okay" required>
            <label for="okay">I understand that the old URL will be inaccessible after relocate this dashboard</label>
          </p>
          <input type="hidden" name="method" value="relocate"/>
        </form>
      `);
    }
    else if (pathname.match(/\/invoices\/?$/)) {
      const { data: invoices } = await stripeAPI(`/v1/invoices`, { data: { subscription: dashboard.subscription } })

      const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));
      const time = (ts) => `<time datetime="${new Date(ts * 1000).toISOString()}">${new Intl.DateTimeFormat(locale).format(new Date(ts * 1000))}</time>`;

      return page({ id })(`
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
            </tr>`).join('')}
          </tbody>
        </table>
      `);
    }
    else if (pathname.match(/\/subscription\/?$/)) {
      let subscription;
      if (method === 'POST') {
        const uuid = elongateId(match[1]);
        const dashboard = await dao.getDashboard(uuid.buffer);
        const fd = await request.formData();

        subscription = await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`, {
          method: 'POST',
          data: { 'cancel_at_period_end': fd.get('undo') ? 'false' : 'true' },
        });
      } else if (method === 'GET') {
        subscription = await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`);
      } else return badRequest()

      const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));
      const time = (ts) => `<time datetime="${new Date(ts * 1000).toISOString()}">${new Intl.DateTimeFormat(locale).format(new Date(ts * 1000))}</time>`;

      return page({ id })(`
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
                <form method="POST" action="/dashboard/${id}/subscription">
                  <button type="submit">Instant Renew Subscription</button>
                  <input type="hidden" name="undo" value="true">
                </form>`
            : `<p>TODO: Implement renew subscription</p>`
          : `
            <form method="POST" action="/dashboard/${id}/subscription">
              <button type="submit">Cancel Subscription</button>
              <p>
                <input type="checkbox" id="cancel-okay" name="okay" required>
                <label for="cancel-okay">I understand that all embedded clap buttons will stop working at the end of the current billing period.</label>
              </p>
            </form>`
        }
      `);
    }
    else if (pathname.match(/\/stats\/?$/)) {
      const timeFrame = requestURL.searchParams.get('time') || '24-hours';
      const [value, unit] = timeFrame.split('-');
      const stats = await dao.getStats(dashboard.hostname, [Number(value), unit]);
      return page({ id })(`
        <h3>Stats</h3>
        <form method="GET" action="/dashboard/${id}/stats">
          <select name="time" onchange="this.form.submit()">
            <option ${timeFrame === '24-hours' ? 'selected' : ''} value="24-hours">24 hours</option>
            <option ${timeFrame === '7-days' ? 'selected' : ''} value="7-days">7 days</option>
            <option ${timeFrame === '30-days' ? 'selected' : ''} value="30-days">30 days</option>
          </select>
          <noscript><button type="submit">Submit</button></noscript>
        </form>
        <br/>
        <table>
          <thead>
            <tr>
              <td>Page</td>
              <td>Views</td>
              <td>Claps</td>
            </tr>
          </thead>
          <tbody>
            ${stats.map(stat => `
              <tr>
                <td>${new URL(stat.href).pathname}</td>
                <td>${stat.views}</td>
                <td>${stat.claps}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `);
    } else {
      return redirect(new URL(`/dashboard/${id}/setup`, WORKER_DOMAIN));
    }
  }
}