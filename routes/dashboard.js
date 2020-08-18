import { UUID } from 'uuid-class';
import sanetize from 'sanitize-html';

import { FaunaDAO } from '../fauna-dao.js';
import { elongateId, shortenId } from '../short-id';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';
import { stripeAPI } from './stripe.js';

const WORKER_DOMAIN = Reflect.get(self, 'WORKER_DOMAIN');
const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

export const styles = `
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif }
  main, nav > div { max-width: 1024px; margin: auto; }
  body.bp3-dark { color: #ccc; background: #282f31; }
  table { width: 100% }
  table td { max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  table tr > td:first-child { width: 60% }
`;

const page = ({ id, title = 'Clap Button Dashboard', headers = {} }) => (content) => new Response(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta name="robots" content="noindex">
    <link href="https://unpkg.com//normalize.css/normalize.css" rel="stylesheet"/>
    <link href="https://unpkg.com/@blueprintjs/icons/lib/css/blueprint-icons.css" rel="stylesheet" />
    <link href="https://unpkg.com/@blueprintjs/core/lib/css/blueprint.css" rel="stylesheet"/>
    <style>${styles}</style>
  </head>
  <body>
    <nav class="bp3-navbar">
      <div>
        <div class="bp3-navbar-group bp3-align-left">
          <div class="bp3-navbar-heading" style="font-weight:bold"><a href="/dashboard/${id}" style="text-decoration:none"><h1 style="font-size:1rem">Clap Button Dashboard</h1></a></div>
        </div>
        <div class="bp3-navbar-group">
          <a class="bp3-button bp3-minimal" href="/dashboard/${id}/stats">Stats</a>
          <span class="bp3-navbar-divider"></span>
          <a class="bp3-button bp3-minimal" href="/dashboard/${id}/subscription">Subscription</a>
        </div>
      </div>
    </nav>
    <div style="padding:0 1rem">
    <main>
      <script>
        document.body.classList.toggle('bp3-dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        window.matchMedia('(prefers-color-scheme: dark)').addListener(function(e) { document.body.classList.toggle('bp3-dark', e.matches); });
      </script>
      ${content}
    </main>
    </div>
  </body>
</html>`, {
  headers: {
    ...headers,
    'Content-Type': 'text/html;charset=UTF-8',
    'X-Robots-Tag': 'noindex',
  }
});

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
  if (match = pathname.match(/\/dashboard\/new\/?/)) {
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
      id,
      customer,
      subscription,
      active: true,
    });

    return redirect(new URL(`/dashboard/${shortenId(id)}`, WORKER_DOMAIN));
  }
  else if (match = pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/?/)) {
    if (!(headers.get('accept') || '').includes('text/html')) return badRequest();

    let id = match[1];
    let uuid = elongateId(id);
    let dashboard = await dao.getDashboard(uuid);
    let setError = false;

    const ip = headers.get('cf-connecting-ip');
    if (ip != null && dashboard.ip !== ip) {
      await dao.upsertDashboard({ id: uuid, ip });
    }

    if (pathname.match(/\/subscription\/?$/)) {
      let subscription;
      if (method === 'POST') {
        const fd = await request.formData();

        subscription = await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`, {
          method: 'POST',
          data: { 'cancel_at_period_end': fd.get('undo') ? 'false' : 'true' },
        });
      } else if (method === 'GET') {
        subscription = await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`);
      } else return badRequest()

      const { data: invoices } = await stripeAPI(`/v1/invoices`, { data: { subscription: dashboard.subscription } })

      const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));
      const time = (ts) => `<time datetime="${new Date(ts * 1000).toISOString()}">${new Intl.DateTimeFormat(locale).format(new Date(ts * 1000))}</time>`;

      return page({ id })(`
      <div class="bp3-running-text">
        <h2>Subscription</h2>
        <p>
          <small class="bp3-tag">${subscription.status.toUpperCase()}</small>
          ${subscription.cancel_at_period_end
          ? `<small>(Will be cancelled on ${time(subscription.current_period_end)})</small>`
          : `<small>(Next billing period starts on ${time(subscription.current_period_end)})</small>)`
        }
        </p>
        ${subscription.cancel_at_period_end
          ? subscription.status === 'active'
            ? `
                <form method="POST" action="/dashboard/${id}/subscription">
                  <button class="bp3-button" type="submit">Instant Renew Subscription</button>
                  <input type="hidden" name="undo" value="true">
                </form>`
            : `<p>TODO: Implement renew subscription</p>`
          : `
            <form method="POST" action="/dashboard/${id}/subscription">
              <button class="bp3-button" type="submit">Cancel Subscription</button>
              <label class="bp3-control bp3-checkbox" style="margin-top:.5rem">
                <input type="checkbox" name="okay" required />
                <span class="bp3-control-indicator"></span>
                I understand that all embedded clap buttons will stop working at the end of the current billing period.
              </label>
            </form>`
        }

        <h2>Invoices</h2>
        <table class="bp3-html-table bp3-html-table-striped">
          <thead>
            <tr>
              <th>Number</th>
              <th>Created</th>
              <th>Status</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(invoice => `<tr>
              <td>#${Number(invoice.number.split('-')[1])}</td>
              <td>${time(invoice.created)}</td>
              <td><span class="bp3-tag bp3-tag-round">${invoice.status.toUpperCase()}</span></td>
              <td>
                <a class="bp3-button bp3-small" href="${invoice.hosted_invoice_url}">HTML</a>
                <a class="bp3-button bp3-small" href="${invoice.invoice_pdf}">PDF</a>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      `);
    }
    else if (pathname.match(/\/stats\/?$/)) {
      const timeFrame = requestURL.searchParams.get('time') || '24-hours';
      const [value, unit] = timeFrame.split('-');
      const { visitors, stats, countries, referrals, totalClaps, totalViews } = await dao.getStats(dashboard.hostname, [Number(value), unit]);
      return page({ id })(`
      <div class="bp3-running-text">
        <h2>Stats</h2>
        <form method="GET" action="/dashboard/${id}/stats">
          <div class="bp3-select">
            <select name="time" onchange="this.form.submit()">
              <option ${timeFrame === '24-hours' ? 'selected' : ''} value="24-hours">24 hours</option>
              <option ${timeFrame === '7-days' ? 'selected' : ''} value="7-days">7 days</option>
              <option ${timeFrame === '30-days' ? 'selected' : ''} value="30-days">30 days</option>
            </select>
          </div>
        </form>
        <br/>
        <dl>
          <dt>Unique visitors</dt><dd><strong>${visitors}</strong></dd>
          <dt>Total page views</dt><dd><strong>${totalViews}</strong></dd>
          <dt>Total claps</dt><dd><strong>${totalClaps}</strong></dd>
        </dl>
        <h3>Top pages</h3>
        <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
          <thead>
            <tr>
              <th>Page</th>
              <th>Views</th>
              <th>Clappers</th>
              <th>Claps</th>
            </tr>
          </thead>
          <tbody>
            ${stats.map(stat => `
              <tr>
                <td title="${sanetize(new URL(stat.href).href)}">${sanetize(new URL(stat.href).pathname)}</td>
                <td>${stat.views}</td>
                <td>${stat.clapRequests}</td>
                <td>${stat.claps}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <h3>Top countries</h3>
        <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
          <thead>
            <tr>
              <th>Country</th>
              <th>Views</th>
            </tr>
          </thead>
          <tbody>
            ${countries.map((stat) => `
              <tr>
                <td>${stat.country}</td>
                <td>${stat.views}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <h3>Top referrers</h3>
        <p>
          If the <a href="https://en.wikipedia.org/wiki/HTTP_referer" target="_blank"><code>Referrer</code></a> of a page view is known, it will be shown here. Direct traffic and empty referrers are omitted.<br/>
          <small style="display:inline-block;margin-top:.5rem">
            Note that many popular sites will remove the referrer when linking to your site, 
            but you can add it back by adding a <code>referrer</code> search parameter to your link, e.g.:
            <span style="white-space:nowrap;text-decoration:underline">https://${dashboard.hostname || 'your-site.com'}/linked-page/?referrer=popularsite.com</span>
          </small>
        </p>
        <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
          <thead>
            <tr>
              <th>Referrer</th>
              <th>Referrals</th>
            </tr>
          </thead>
          <tbody>
            ${referrals.map((stat) => `
              <tr>
                <td title="${sanetize(new URL(stat.referrer).href)}">${sanetize(new URL(stat.referrer).href)}</td>
                <td>${stat.referrals}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      `);
    }
    else if (pathname.match(/\/dashboard\/([0-9A-Za-z-_]{22})\/?$/)) {
      const isMac = (headers.get('user-agent') || '').match(/mac/i);
      let isBookmarked = (headers.get('cookie') || '').includes(`bookmarked=${id}`);
      let cookieDNT = (headers.get('cookie') || '').includes(`dnt=${encodeURIComponent(dashboard.hostname)}`);
      let setHeaders;

      /** @param {boolean} dnt */
      const mkCookie = (dnt) => {
        return dnt
          ? `dnt=${encodeURIComponent(dashboard.hostname)}; Path=/; SameSite=None; Secure; Expires=${new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toUTCString()}`
          : `dnt=${encodeURIComponent(dashboard.hostname)}; Path=/; SameSite=None; Secure; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`
      }

      if (dashboard.dnt !== cookieDNT) {
        setHeaders = { 'Set-Cookie': mkCookie(dashboard.dnt) };
        cookieDNT = dashboard.dnt;
      }

      if (method === 'POST') {
        const fd = await request.formData();
        switch (fd.get('method')) {
          case 'domain': {
            try {
              // @ts-ignore
              dashboard = await dao.updateDomain(uuid.buffer, new URL(fd.get('hostname')).hostname);
            } catch (err) {
              if (err instanceof Response) {
                if (err.status === 409) {
                  setError = true;
                }
              } else throw err;
            }
            break;
          }
          case 'relocate': {
            const oldUUID = elongateId(match[1]);
            const newUUID = UUID.v4();
            const { subscription } = await dao.relocateDashboard(oldUUID, newUUID);
            const newId = shortenId(newUUID);
            await stripeAPI(`/v1/subscriptions/${subscription}`, {
              method: 'POST',
              data: { 'metadata[dashboard_id]': shortenId(newUUID) },
            });
            return redirect(new URL(`/dashboard/${newId}/key`, WORKER_DOMAIN));
          }
          case 'cookie': {
            isBookmarked = true;
            setHeaders = { 'Set-Cookie': `bookmarked=${id}` };
            break;
          }
          case 'dnt': {
            cookieDNT = fd.get('dnt') === 'on'
            setHeaders = { 'Set-Cookie': mkCookie(cookieDNT) };
            await dao.upsertDashboard({ id: uuid, dnt: cookieDNT });
            break;
          }
          default: return badRequest();
        }
      } else if (method !== 'GET') return badRequest();

      return page({ id, headers: setHeaders })(`
      <div class="bp3-running-text">
        <h2>Key</h2>
        <details style="margin-bottom:1rem">
          <summary>You current dashboard key is: (Click to open)</summary>
          <strong><code style="font-size:1rem">${id}</code></strong>
        </details>
        ${!isBookmarked ? `
          <div id="bookmark-warning" class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
            <h4 class="bp3-heading">Please bookmark this page!</h4>
            Please bookmark this page by pressing <strong>${isMac ? '⌘' : 'Ctrl'}+D</strong> on your keyboard.
            Your key is your primary access credential to this dashboard.
            If you lose your key we'll have to manually restore access to your dashboard. 
            <script>document.addEventListener('keydown', function(e) { 
              if (e.metaKey === true && e.code === 'KeyD') { 
                document.cookie = \`bookmarked=${id}\`; 
                document.getElementById('bookmark-warning').style.display = 'none'; 
              } 
            })</script>
            <form method="POST" action="/dashboard/${id}">
              <input type="hidden" name="method" value="cookie"/>
              <button class="bp3-button" type="submit">I've bookmarked this page</button>
            </form>
          </div>
        `: ''}
        <form method="POST" action="/dashboard/${id}">
          <input type="hidden" name="method" value="relocate"/>
          <p>If you've accidentally published your dashboard key, you can invalidate it by <em>relocating</em> this dashboard to a new URL:</p>
          <button class="bp3-button" type="submit">Relocate Dashboard</button>
          <label class="bp3-control bp3-checkbox" style="margin-top:.5rem">
            <input type="checkbox" name="okay" required />
            <span class="bp3-control-indicator"></span>
            I understand that the current dashboard URL will be inaccessible after relocating
          </label>
        </form>

        <h2>Domain</h2>
        <details style="margin-bottom:1rem" open>
          <summary>Your current domain is:</summary>
          <strong>${sanetize(dashboard.hostname)}</strong>
        </details>
        ${dashboard.hostname == null ? `
          <div class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
            <h4 class="bp3-heading">Please set a domain</h4>
            Once you've set a domain, Clap Button will show and persist claps on all pages within that domain.
          </div>
        `: ''}
        <form method="POST" action="/dashboard/${id}">
          <input type="hidden" name="method" value="domain"/>
          <input class="bp3-input" type="url" name="hostname" placeholder="https://example.com" value="https://" required/>
          <button class="bp3-button" type="submit">Set domain</button>
          ${setError ? `<div class="bp3-callout bp3-intent-danger">Someone is already using that domain!</div>` : ''}
        </form>

        <h2>Settings</h2>
        <form method="POST" action="/dashboard/${id}">
          <input type="hidden" name="method" value="dnt"/>
          <label class="bp3-control bp3-switch bp3-large" style="margin-top:.5rem;">
            <input type="checkbox" name="dnt" ${cookieDNT ? 'checked' : ''}/>
            <span class="bp3-control-indicator"></span>
            Don't track myself
          </label>
          <p>
            Use this option to prevent browsing your own site from distorting statistics.<br/>
            <small style="display:inline-block;margin-top:.5rem;">
              This option will set a cookie in this browser as well as every other browser that opens this dashboard.<br/>
              It will also cause all views from the last IP address that accessed this dashboard to be ignored.
            </small>
          </p>
          <script>document.querySelector('input[name="dnt"]').addEventListener('change', function(e) { setTimeout(function () { e.target.form.submit() }, 500) })</script>
          <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
        </form>
      </div>
      `);
    }
    else {
      return redirect(new URL(`/dashboard/${id}`, WORKER_DOMAIN));
    }
  }
  else {
    return page({ id: '' })(``)
  }
}