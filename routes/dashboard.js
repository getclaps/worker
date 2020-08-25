import { UUID } from 'uuid-class';

import { FaunaDAO } from '../fauna-dao.js';
import { elongateId, shortenId } from '../short-id';
import { ok, badRequest, forbidden, notFound, redirect } from '../response-types';
import { stripeAPI } from './stripe.js';
import { html, css, unsafeHTML, HTML } from '../html';
// import { Base64Encoder } from 'base64-encoding';

import { countries } from '../countries.js';

const countriesByCode = Object.fromEntries(countries.map(x => [x.code, x]));

const WORKER_DOMAIN = Reflect.get(self, 'WORKER_DOMAIN');
const NAMESPACE = 'c4e75796-9fe6-ce66-612e-534b709074ef';

const oneYearFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

// /** @param {string} text */
// const shortHash = async (text) => new Base64Encoder().encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 7);

const Secure = WORKER_DOMAIN.includes('localhost') ? '' : 'Secure;';

/** @param {string} hostname */ const mkDNTCookieKey = hostname => `dnt_${encodeURIComponent(hostname)}`;
/** @param {string} hostname @param {boolean} dnt */ const mkDNTCookie = (dnt, hostname) => {
  return dnt
    ? `${mkDNTCookieKey(hostname)}=; Path=/; SameSite=None; ${Secure}; HttpOnly; Expires=${oneYearFromNow().toUTCString()}`
    : `${mkDNTCookieKey(hostname)}=; Path=/; SameSite=None; ${Secure}; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`
}

/** @param {string} hostname */ const mkBookmarkedCookieKey = hostname => `bkd_${encodeURIComponent(hostname)}`;
/** @param {string} hostname */ const mkBookmarkedCookie = hostname => {
  return `${mkBookmarkedCookieKey(hostname)}=; Path=/dashboard; SameSite=Strict; ${Secure} Expires=${oneYearFromNow().toUTCString()}`;
}

/** @param {string} id */
const mkLoginCookie = (id) => {
  return `did=${id}; Path=/dashboard; SameSite=Strict; ${Secure} HttpOnly; Expires=${oneYearFromNow().toUTCString()}`;
}

const mkLogoutCookie = () => {
  return `did=; Path=/dashboard; SameSite=Strict; ${Secure} HttpOnly; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

/** @param {string} cookie @returns {Map<string, string>} */
const parseCookie = (cookie) => new Map(cookie.split(/;\s*/)
  .map(x => x.split('='))
  .map(/** @returns {[string, string]} */([k, v]) => [k, v])
  .filter(([k]) => !!k)
);

export const styles = css`
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif }
  main, nav > div { max-width: 1024px; margin: auto; }
  body { padding: 3rem 0; overflow-x: hidden; }
  body.bp3-dark { color: #ccc; background: #293742; }
  table { width: 100% }
  table td { max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  table.bp3-html-table-condensed tr > td:first-child { width: 75% }
  @media screen and (min-width: 768px) {
    .row { display:flex; margin:0 -.5rem; }
    .col { flex:1; margin:0 .5rem; } }
  div.stats-card {
    max-width: 640px; }
  dl.stats {
    display: grid;
    grid-gap: 0 1rem;
    grid-template-columns: repeat(3, 33%);
    grid-template-rows: auto auto;
    grid-template-areas:
        "a1 b1 c1"
        "a2 b2 c2";
    font-size: larger; }
  dl.stats > dd { 
    margin-left: 0;
    font-size: 2rem; }
  dl.stats > dt:nth-of-type(1) { grid-area: a1 }
  dl.stats > dt:nth-of-type(2) { grid-area: b1 }
  dl.stats > dt:nth-of-type(3) { grid-area: c1 }
  dl.stats > dd:nth-of-type(1) { grid-area: a2 }
  dl.stats > dd:nth-of-type(2) { grid-area: b2 }
  dl.stats > dd:nth-of-type(3) { grid-area: c2 }
  input[name=password] { font-family: system-ui-monospace, "Liberation Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "DejaVu Sans Mono", "Fira Code", "Droid Sans Mono", "Menlo", "Consolas", "Monaco", monospace; }
  .flex-center {
    display: flex;
    justify-content: center; }
`;

/**
 * @param {{ title?: string, hostname?: string, isBookmarked?: boolean, headers?: HeadersInit }} [param0]
 * @returns {(content: string|HTML) => Response}
 */
const page = ({ title = 'Clap Button Dashboard', hostname = null, isBookmarked = false, headers = [] } = {}) => (content) => new Response(html`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>${title}</title>
    <meta name="robots" content="noindex">
    <link href="https://unpkg.com//normalize.css/normalize.css" rel="stylesheet"/>
    <link href="https://unpkg.com/@blueprintjs/icons/lib/css/blueprint-icons.css" rel="stylesheet" />
    <link href="https://unpkg.com/@blueprintjs/core/lib/css/blueprint.css" rel="stylesheet"/>
    <style>${styles}</style>
  </head>
  <body>
    <nav class="bp3-navbar" style="position:fixed; top:0;">
      <div>
        <div class="bp3-navbar-group bp3-align-left">
          <div class="bp3-navbar-heading" style="font-weight:bold">
            <a href="/dashboard" style="text-decoration:none">
              <h1 style="font-size:1rem">${hostname || title}</h1>
            </a>
          </div>
        </div>
        <div id="unlock" class="bp3-navbar-group" style="visibility: ${hostname == null || !isBookmarked ? 'hidden' : 'visible'}">
          <a class="bp3-button bp3-minimal" href="/dashboard/stats">Stats</a>
          <span class="bp3-navbar-divider"></span>
          <a class="bp3-button bp3-minimal" href="/dashboard/subscription">Subscription</a>
          <span class="bp3-navbar-divider"></span>
          <a class="bp3-button bp3-minimal" href="/dashboard/logout">Logout</a>
          <script type="module">
            if ('PasswordCredential' in window) (() => {
              document.querySelectorAll('a[href="/dashboard/logout"]').forEach(el => el.addEventListener('click', () => {
                navigator.credentials.preventSilentAccess()
              }));
            })();
          </script>
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
</html>`.toString(), {
  headers: [
    ...new Headers(headers),
    ['Content-Type', 'text/html;charset=UTF-8'],
    ['X-Robots-Tag', 'noindex'],
  ]
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
export async function handleDashboard({ request, requestURL, method, path: [, dir], headers }) {
  const dao = new FaunaDAO();

  const [[locale]] = (headers.get('accept-language') || 'en-US').split(',').map(_ => _.split(';'));

  if (dir === 'new') {
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
      dnt: false,
    });

    return redirect(new URL(`/dashboard`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLoginCookie(shortenId(id))]],
    });
  }

  else if (dir === 'logout') {
    return redirect(new URL(`/dashboard`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLogoutCookie()]]
    });
  }

  else if (dir === 'login') {
    if (method === 'POST') {
      const formData = await request.formData()
      const id = formData.get('password').toString();
      const hostname = formData.get('id').toString();

      try {
        const uuid = elongateId(id);
        const d = await dao.getDashboard(uuid);
        if (!d) throw Error();
      } catch {
        return redirect(new URL(`/dashboard`, WORKER_DOMAIN))
      }

      return redirect(new URL(`/dashboard`, WORKER_DOMAIN), {
        headers: [
          ['Set-Cookie', mkLoginCookie(id)],
          ['Set-Cookie', mkBookmarkedCookie(hostname)]
        ],
      });
    }

    return notFound();
  }

  else if (/([A-Za-z0-9-_]{22})/.test(dir)) {
    const [, id] = dir.match(/([A-Za-z0-9-_]{22})/);
    return redirect(new URL(`/dashboard`, WORKER_DOMAIN), {
      headers: [['Set-Cookie', mkLoginCookie(id)]],
    });
  }

  else {
    // if (!(headers.get('accept') || '').includes('text/html')) return badRequest();
    const cookies = parseCookie(headers.get('cookie') || '');

    const id = cookies.get('did');
    if (!id) return loginPage();

    const uuid = elongateId(id);
    let dashboard = await dao.getDashboard(uuid);
    let showError = false;

    let isBookmarked = cookies.has(mkBookmarkedCookieKey(dashboard.hostname));

    const ip = headers.get('cf-connecting-ip');
    if (ip != null && dashboard.ip !== ip) {
      await dao.upsertDashboard({ id: uuid, ip });
    }

    if (dir === 'subscription') {
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

      const time = (ts) => {
        const d = new Date(ts * 1000);
        return html`<time datetime="${d.toISOString()}">${new Intl.DateTimeFormat(locale).format(d)}</time>`;
      }

      return page({ hostname: dashboard.hostname, isBookmarked })(html`
      <div class="bp3-running-text">
        <h2>Subscription</h2>
        <p>
          <small class="bp3-tag">${subscription.status.toUpperCase()}</small>
          ${subscription.cancel_at_period_end
          ? html`<small>(Will be cancelled on ${time(subscription.current_period_end)})</small>`
          : html`<small>(Next billing period starts on ${time(subscription.current_period_end)})</small>)`
        }
        </p>
        ${subscription.cancel_at_period_end
          ? subscription.status === 'active'
            ? html`
                <form method="POST" action="/dashboard/subscription">
                  <button class="bp3-button" type="submit">Instant Renew Subscription</button>
                  <input type="hidden" name="undo" value="true">
                </form>`
            : html`<p>TODO: Implement renew subscription</p>`
          : html`
            <form method="POST" action="/dashboard/subscription">
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
            ${invoices.map(invoice => html`<tr>
              <td>#${Number(invoice.number.split('-')[1])}</td>
              <td>${time(invoice.created)}</td>
              <td><span class="bp3-tag bp3-tag-round">${invoice.status.toUpperCase()}</span></td>
              <td>
                <a class="bp3-button bp3-small" href="${invoice.hosted_invoice_url}">HTML</a>
                <a class="bp3-button bp3-small" href="${invoice.invoice_pdf}">PDF</a>
              </td>
            </tr>`)}
          </tbody>
        </table>
      </div>
      `);
    }
    else if (dir === 'stats') {
      const timeFrame = requestURL.searchParams.get('time') || '24-hours';
      const [value, unit] = timeFrame.split('-');
      const { visitors, views, claps, countries, referrals, totalClaps, totalViews } = await dao.getStats(dashboard.hostname, [Number(value), unit]);
      return page({ hostname: dashboard.hostname, isBookmarked })(html`
      <div class="bp3-running-text">
        <h2>Stats</h2>
        <form method="GET" action="/dashboard/stats">
          <label class="bp3-label bp3-inline">
            Show data for the last
            <div class="bp3-select">
              <select name="time">
                <option ${timeFrame === '12-hours' ? 'selected' : ''} value="12-hours">12 hours</option>
                <option ${timeFrame === '24-hours' ? 'selected' : ''} value="24-hours">24 hours</option>
                <option ${timeFrame === '7-days' ? 'selected' : ''} value="7-days">7 days</option>
                <option ${timeFrame === '30-days' ? 'selected' : ''} value="30-days">30 days</option>
              </select>
            </div>
            <script>document.querySelector('select[name=time]').addEventListener('change', function(e) { e.target.form.submit() })</script>
            <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
          </label>
        </form>
        <div class="stats-card bp3-card bp3-elevation-2">
          <dl class="stats">
            <dt>Unique visitors</dt><dd><strong>${visitors.toLocaleString(locale)}</strong></dd>
            <dt>Total page views</dt><dd><strong>${totalViews.toLocaleString(locale)}</strong></dd>
            <dt>Total claps</dt><dd><strong>${totalClaps.toLocaleString(locale)}</strong></dd>
          </dl>
        </div>
        <div class="row">
          <div class="col">
            <h3>Top pages <small>by views</small></h3>
            <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                ${views.slice(0, 16).map(stat => html`
                  <tr>
                    <td title="${new URL(stat.href).href}">${new URL(stat.href).pathname}</td>
                    <td>${stat.views}</td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
          <div class="col">
            <h3>Top pages <small>by claps</small></h3>
            <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Claps</th>
                  <th>Clappers</th>
                </tr>
              </thead>
              <tbody>
                ${claps.slice(0, 16).map(stat => html`
                  <tr>
                    <td title="${new URL(stat.href).href}">${new URL(stat.href).pathname}</td>
                    <td>${stat.claps}</td>
                    <td>${stat.clappers}</td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
        </div>
        <div class="row">
          <div class="col">
            <h3>Top countries</h3>
            <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                ${countries.slice(0, 16).map((stat) => html`
                  <tr>
                    <td>${(countriesByCode[stat.country] || {}).emoji || ''} ${(countriesByCode[stat.country] || {}).name || stat.country}</td>
                    <td>${stat.views}</td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
          <div class="col">
            <h3>Top referrers</h3>
            <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th>Referrals</th>
                </tr>
              </thead>
              <tbody>
                ${referrals.slice(0, 16).map((stat) => html`
                  <tr>
                    <td title="${new URL(stat.referrer).href}">${new URL(stat.referrer).href}</td>
                    <td>${stat.referrals}</td>
                  </tr>`)}
              </tbody>
            </table>
            <p>
              If the <a href="https://en.wikipedia.org/wiki/HTTP_referer" target="_blank"><code>Referrer</code></a> of a page view is known, it will be shown here. Direct traffic and empty referrers are omitted.<br/>
              <small style="display:inline-block;margin-top:.5rem">
                Note that many popular sites will remove the referrer when linking to your site, 
                but you can add it back by adding a <code>referrer</code> search parameter to your link, e.g.:
                <span style="white-space:nowrap;text-decoration:underline">https://${dashboard.hostname || 'your-site.com'}/linked-page/?referrer=popularsite.com</span>
              </small>
            </p>
          </div>
        </div>
      </div>
      `);
    }
    else if (!dir) {
      // const isMac = (headers.get('user-agent') || '').match(/mac/i);
      let cookieDNT = cookies.has(mkDNTCookieKey(dashboard.hostname));
      let setHeaders = new Headers();

      // const customer = await stripeAPI(`/v1/customers/${dashboard.customer}`)

      if (dashboard.dnt !== cookieDNT) {
        setHeaders.append('set-cookie', mkDNTCookie(dashboard.dnt, dashboard.hostname))
        cookieDNT = dashboard.dnt;
      }

      if (method === 'POST') {
        const fd = await request.formData();
        switch (fd.get('method')) {
          case 'domain': {
            try {
              dashboard = await dao.updateDomain(uuid, new URL(fd.get('hostname').toString()).hostname);
            } catch (err) {
              if (err instanceof Response) {
                if (err.status === 409) {
                  showError = true;
                } else throw err;
              } else throw err;
            }
            break;
          }
          case 'relocate': {
            const oldUUID = elongateId(id);
            const newUUID = UUID.v4();
            const { subscription } = await dao.relocateDashboard(oldUUID, newUUID);
            const newId = shortenId(newUUID);
            await stripeAPI(`/v1/subscriptions/${subscription}`, {
              method: 'POST',
              data: { 'metadata[dashboard_id]': shortenId(newUUID) },
            });
            return redirect(new URL(`/dashboard`, WORKER_DOMAIN), {
              headers: [['Set-Cookie', mkLoginCookie(newId)]],
            });
          }
          // case 'cookie': {
          //   isBookmarked = true;
          //   setHeaders = { 'Set-Cookie': await mkBookmarkedCookie(id) }
          //   break;
          // }
          case 'dnt': {
            cookieDNT = fd.get('dnt') === 'on'
            setHeaders.append('Set-Cookie', mkDNTCookie(cookieDNT, dashboard.hostname));
            await dao.upsertDashboard({ id: uuid, dnt: cookieDNT });
            break;
          }
          default: break;
        }
      } else if (method !== 'GET') return badRequest();

      return page({ hostname: dashboard.hostname, isBookmarked, headers: setHeaders })(html`
      <div class="bp3-running-text">
        ${dashboard.hostname == null ? '' : html`<h2>Key</h2>
        <form id="login" method="POST" action="/dashboard/login" class="bp3-inline" autocomplete="on">
          <input type="text" class="bp3-input" name="id" value="${dashboard.hostname}" hidden readonly autocomplete="username" />
          <div class="bp3-input-group" style="display:inline-block; width:16rem">
            <span class="bp3-icon bp3-icon-key"></span>
            <input type="password" class="bp3-input" name="password" value="${id}" readonly autocomplete="current-password" />
            <button class="bp3-button bp3-minimal bp3-icon-eye-open"></button>
          </div>
          <button class="bp3-button" type="submit">Store Password</button>
          <script>
            document.querySelector('input[name=password] + button').addEventListener('click', function(e) { 
              e.preventDefault();
              var el = e.target;
              var show = el.classList.contains('bp3-icon-eye-open');
              el.classList.toggle('bp3-icon-eye-open', !show);
              el.classList.toggle('bp3-icon-eye-off', show);
              el.previousElementSibling.type = show ? 'text' : 'password';
            });
          </script>
          ${isBookmarked ? '' : html`<div id="bookmark-warning" class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
            <h4 class="bp3-heading">Please store your credentials!</h4>
            Please use your browser's password manager to store the credentials.<br/>
            Use the <button type="submit" class="bp3-button bp3-minimal bp3-small" style="display:inline-block">Store Password</button> 
            button to trigger your browsers store password dialog.
          </div>`}
        </form>
        <script type="module">
         if ('PasswordCredential' in window) {
            document.querySelectorAll('form#login button[type=submit]').forEach(el => el.addEventListener('click', async (e) => {
              e.preventDefault();
              const cred = new PasswordCredential(document.querySelector('form#login'));
              await navigator.credentials.store(cred);
              document.cookie = '${mkBookmarkedCookie(dashboard.hostname)}';
              document.querySelector('#bookmark-warning').remove();
              document.querySelector('#unlock').style.visibility = 'visible';
            }));
          }
        </script>
        ${/*<form method="POST" action="/dashboard">
          <input type="hidden" name="method" value="relocate"/>
          <p>If you've accidentally published your dashboard key, you can invalidate it by <em>relocating</em> this dashboard to a new URL:</p>
          <button class="bp3-button" type="submit">Relocate Dashboard</button>
          <label class="bp3-control bp3-checkbox" style="margin-top:.5rem">
            <input type="checkbox" name="okay" required />
            <span class="bp3-control-indicator"></span>
            I understand that the current dashboard URL will be inaccessible after relocating
          </label>
        </form>*/''}
        `}

        <h2>Domain</h2>
        <details style="margin-bottom:1rem" open>
          <summary>Your current domain is:</summary>
          <strong>${dashboard.hostname}</strong>
        </details>
        ${dashboard.hostname != null ? '' : html`
          <div class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
            <h4 class="bp3-heading">Please set a domain</h4>
            You can change this later. 
            Once you've set a domain, Clap Button will show and persist claps on all pages within that domain.
          </div>
        `}
        <form method="POST" action="/dashboard">
          <input type="hidden" name="method" value="domain"/>
          <div class="bp3-input-group" style="display:inline-block; width:16rem">
            <span class="bp3-icon bp3-icon-globe-network"></span>
            <input type="url" class="bp3-input" name="hostname" placeholder="https://example.com" value="https://" required/>
          </div>
          <button class="bp3-button" type="submit">Set domain</button>
          ${showError ? `<div class="bp3-callout bp3-intent-danger">Someone is already using that domain!</div>` : ''}
        </form>

        ${dashboard.hostname == null ? '' : html`
          <h3>Settings</h3>
          <form method="POST" action="/dashboard">
            <input type="hidden" name="method" value="dnt"/>
            <label class="bp3-control bp3-switch bp3-large" style="margin-top:.5rem;">
              <input type="checkbox" name="dnt" ${cookieDNT ? 'checked' : ''}/>
              <span class="bp3-control-indicator"></span>
              Don't track myself
            </label>
            <p>
              Use this option to prevent browsing your own site from distorting statistics.<br/>
              <small style="display:inline-block;margin-top:.5rem;">
                Setting this option will set a cookie that will cause all page views from this browser to be ignored,
                as well as all page views from the last IP address that accessed this dashboard.
              </small>
            </p>
            <p>
              <small>Last login from: <span>${dashboard.ip}</span></small>
            </p>
            <script>document.querySelector('input[name="dnt"]').addEventListener('change', function(e) { setTimeout(function () { e.target.form.submit() }, 500) })</script>
            <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
          </form>
        </div>`}
      `);
    }
    else {
      return notFound();
    }
  }
}

function loginPage() {
  // const response = fetch('/dashboard/login', { method: 'POST', redirect });b
  return page()(html`
    <div class="flex-center" style="margin-top:3rem">
      <form id="login" method="POST" action="/dashboard/login" class="bp3-inline" autocomplete="on">
        <div class="bp3-form-group">
          <label class="bp3-label" for="form-group-input">
            Key
            <span class="bp3-text-muted">(required)</span>
          </label>
          <div class="bp3-form-content">
            <div class="bp3-input-group" style="width:16rem">
              <span class="bp3-icon bp3-icon-key"></span>
              <input type="password" class="bp3-input" name="password" autocomplete="current-password" required />
            </div>
            <div class="bp3-form-helper-text">Input the dashboard key using your password manager.</div>
          </div>
        </div>
        <div class="bp3-form-group">
          <label class="bp3-label" for="form-group-input">
            Domain
            <span class="bp3-text-muted">(optional)</span>
          </label>
          <div class="bp3-form-content">
            <div class="bp3-input-group" style="width:16rem">
              <span class="bp3-icon bp3-icon-globe-network"></span>
              <input type="text" class="bp3-input" name="id" autocomplete="username" />
            </div>
          </div>
        </div>
        <button class="bp3-button" type="submit">Login</button>
      </form>
    </div>
    <script type="module">
      if ('PasswordCredential' in window) (async () => {
        const cred = await navigator.credentials.get({ password: true });
        if (!cred) {
          console.log('why no cred?');
        } else {
          const { id, password } = cred;
          const body = new URLSearchParams(Object.entries({ method: 'login', id, password }));
          const response = await fetch('/dashboard/login', { method: 'POST', body, redirect: 'manual' });
          // cookie set, reload page
          window.location.reload();
        }
      })();
    </script>
  `)
}
