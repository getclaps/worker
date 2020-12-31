import { html } from '@werker/html';

import { HeadersCookieStore } from '../../vendor/middleware/cookie-store';

import { Dashboard } from '../../dao';
import { ConflictError } from '../../errors';
import { router, DashboardArgs } from '../../router';
import * as cc from '../cookies';
import { withDashboard } from './with-dashboard';
import { page } from './components';

const storePassword = html`<button type="submit" class="bp3-button bp3-minimal bp3-small" style="display:inline-block">Store Password</button>`;

async function settingsPage(
  { uuid, id, cookies, dao, isBookmarked }: DashboardArgs, 
  { headers = new Headers(), dashboard, cookieDNT, showError }: {
    headers?: Headers, 
    dashboard?: Dashboard, 
    cookieDNT?: boolean, 
    showError?: boolean,
  } = {},
) {
  return page({ dir: 'settings', cookies, uuid, isBookmarked, headers })(async () => {
    try {
      dashboard = dashboard || await dao.getDashboard(uuid);
    } catch (e) {
      throw html`<div>Something went wrong.</div>`;
    }

    const hn = dashboard.hostname[0];
    cookieDNT = cookieDNT || cookies.has(cc.dntCookieKey(hn));
    if (dashboard.dnt !== cookieDNT) cookieDNT = dashboard.dnt;

    return html`
    <div class="bp3-running-text">
      <div class="row">
        <div>
          <h3>Domain</h3>
          ${dashboard.hostname.length ? '' : html`
          <div class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
            <h4 class="bp3-heading">Please set a domain</h4>
            You can change this later.
            Once you've set a domain, Clap Button will show and persist claps on all pages within that domain.
            </div>`}
          <form method="POST" action="/settings">
            <input type="hidden" name="method" value="domain"/>
            <div class="bp3-input-group" style="display:inline-block; width:16rem">
              <span class="bp3-icon bp3-icon-globe-network"></span>
              <input type="url" class="bp3-input" name="hostname" placeholder="https://example.com" value="https://" required />
            </div>
            <button class="bp3-button bp3-icon-add" type="submit">Add domain</button>
            ${showError 
                ? html`<div class="bp3-callout bp3-intent-danger">Someone is already using that domain!</div>` 
                : ''}
          </form>
          ${dashboard.hostname.length 
            ? html`<form method="POST" action="/settings" style="margin-top:.5rem">
                <input type="hidden" name="method" value="delete-domain"/>
                <p>
                  Your current domains are:
                  <ul>${dashboard.hostname.map((h, i) =>
                    html`<li>
                      ${i === 0 
                        ? html`<strong>${h}</strong>` 
                        : h}
                      ${dashboard.hostname.length > 1 
                        ? html`<button class="bp3-button bp3-small bp3-icon-delete" type="submit" name="hostname" value="https://${h}"></button>` 
                        : ''}
                     </li>`
                  )}</ul>
                </p>
              </form>`
            : ''}
        </div>
    
        ${dashboard.hostname.length === 0 ? html`<div></div>` : html`<div>
          <h3>Key</h3>
          <form id="login" method="POST" action="/login" class="bp3-inline" autocomplete="on">
            <input type="hidden" name="referrer" value="/settings" />
            <input type="text" class="bp3-input" name="id" value="${dashboard.hostname[0]}" hidden readonly autocomplete="username" />
            <div class="bp3-input-group" style="display:inline-block; width:16rem">
              <span class="bp3-icon bp3-icon-key"></span>
              <input type="password" class="bp3-input" name="password" value="${id}" readonly autocomplete="new-password" />
              <button class="bp3-button bp3-minimal bp3-icon-eye-open"></button>
            </div>
            <button class="bp3-button bp3-icon-database" type="submit">Store Password</button>
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
            <p style="margin-top:.5rem" class="unlock ${dashboard.hostname.length === 0 || !isBookmarked ? 'hidden' : ''}">
              Clicking the ${storePassword} button will trigger your browser's password manager.
              Use it to store the key to this dashboard.
              <br /><small style="display:inline-block;margin-top:.5rem;">If you've already stored the key, clicking the
                button will have no effect.</small>
            </p>
            ${!isBookmarked 
               ? html`
                <div id="bookmark-warning" class="bp3-callout bp3-intent-warning bp3-icon-warning-sign"
                  style="margin-bottom:1rem;">
                  <h4 class="bp3-heading">Please store your credentials!</h4>
                  Please use your browser's password manager to store the credentials.<br />
                  Use the ${storePassword} button to trigger your browsers store password dialog.
                </div>`
               : ''}
          </form>
          <script type="module">
            if ('PasswordCredential' in window) {
              document.querySelectorAll('form#login button[type=submit]').forEach(el => el.addEventListener('click', async (e) => {
                e.preventDefault();
                const cred = new PasswordCredential(document.querySelector('form#login'));
                await navigator.credentials.store(cred);
                document.cookie = '${HeadersCookieStore.toSetCookie(await cc.bookmarkedCookie(id))}';
                if (document.querySelector('#bookmark-warning')) document.querySelector('#bookmark-warning').remove();
                document.querySelectorAll('.unlock').forEach(el => { el.classList.remove('hidden') });
              }));
            }
          </script>
          ${/*<form method="POST" action="/dashboard">
            <input type="hidden" name="method" value="relocate" />
            <p>If you've accidentally published your dashboard key, you can invalidate it by <em>relocating</em> this
              dashboard to a new URL:</p>
            <button class="bp3-button" type="submit">Relocate Dashboard</button>
            <label class="bp3-control bp3-checkbox" style="margin-top:.5rem">
              <input type="checkbox" name="okay" required />
              <span class="bp3-control-indicator"></span>
              I understand that the current dashboard URL will be inaccessible after relocating
            </label>
          </form>*/''}
        </div>
        `}
      </div>
    
      <div class="row">
        <div class="unlock ${dashboard.hostname.length === 0 || !isBookmarked ? 'hidden' : ''}">
          <h3>Self-Tracking</h3>
          <form method="POST" action="/settings">
            <input type="hidden" name="method" value="dnt" />
            <label class="bp3-control bp3-switch bp3-large" style="margin-top:.5rem;">
              <input type="checkbox" name="dnt" ${cookieDNT ? 'checked' : '' } />
              <span class="bp3-control-indicator"></span>
              Don't track myself
            </label>
            <p>
              Use this option to prevent browsing your own site from distorting statistics.
              <br /><small style="display:inline-block;margin-top:.5rem;">
                Setting this option will set a cookie that will cause all page views from this browser to be ignored,
                as well as all page views from the last IP address that accessed this dashboard.
              </small>
            </p>
            ${dashboard.ip ? html`<p><small>Last login from: <code>${dashboard.ip}</code></small></p>` : ''}
            <script>
              document.querySelector('input[name="dnt"]').addEventListener('change', function(e) { setTimeout(function () { e.target.form.submit() }, 500) })
            </script>
            <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
          </form>
        </div>
        <div></div>
      </div>
      <script>document.cookie = '${HeadersCookieStore.toSetCookie(cc.dntCookie(dashboard.dnt, dashboard.hostname[0]))}';</script>
      <script>document.cookie = '${HeadersCookieStore.toSetCookie(await cc.hostnameCookie(id, dashboard.hostname[0]))}';</script>
    `;
  });
}

router.get('/settings', withDashboard(settingsPage))
router.post('/settings', withDashboard(async (args) => {
  const { request, dao, uuid, cookieStore } = args;

  const headers = new Headers();

  let showError = false;
  let dashboard: Dashboard;
  let cookieDNT: boolean;

  const fd = await request.formData();
  switch (fd.get('method')) {
    case 'domain': {
      try {
        dashboard = await dao.appendDomain(uuid, new URL(fd.get('hostname').toString()).hostname);
      } catch (err) {
        if (err instanceof ConflictError) { showError = true } else throw err;
      }
      break;
    }
    case 'delete-domain': {
      try {
        dashboard = await dao.removeDomain(uuid, new URL(fd.get('hostname').toString()).hostname);
      } catch (err) {
        if (err instanceof ConflictError) { showError = true } else throw err;
      }
      break;
    }
    case 'dnt': {
      cookieDNT = fd.get('dnt') === 'on'
      dashboard = await dao.upsertDashboard({ id: uuid, dnt: cookieDNT });
      const hn = dashboard.hostname[0];
      await cookieStore.set(cc.dntCookie(cookieDNT, hn));
      break;
    }
    // case 'relocate': {
    //   const oldUUID = elongateId(id);
    //   const newUUID = UUID.v4();
    //   const { subscription } = await dao.relocateDashboard(oldUUID, newUUID);
    //   const newId = shortenId(newUUID);
    //   await stripeAPI(`/v1/subscriptions/${subscription}`, {
    //     method: 'POST',
    //     data: { 'metadata[dashboard_id]': shortenId(newUUID) },
    //   });
    //   cookies.set(cc.loginCookie(newId));
    //   return re.seeOther(`/dashboard`);
    default: break;
  }
  return settingsPage(args, { headers: headers, dashboard: dashboard, cookieDNT: cookieDNT, showError });
}));
