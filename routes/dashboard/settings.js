import * as r from '../../response-types';
import { html } from '../../html';
import { page } from './page';

import { mkDNTCookie, mkDNTCookieKey, mkBookmarkedCookie } from '../dashboard';

/** @param {import('../dashboard').Snowball} param0 */
export async function settingsPage({ method, uuid, id, dashboard, cookies, request, dao, isBookmarked }) {
  // const isMac = (headers.get('user-agent') || '').match(/mac/i);
  let cookieDNT = cookies.has(mkDNTCookieKey(dashboard.hostname));
  let setHeaders = new Headers();
  let showError = false;

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
      case 'dnt': {
        cookieDNT = fd.get('dnt') === 'on'
        setHeaders.append('Set-Cookie', mkDNTCookie(cookieDNT, dashboard.hostname));
        await dao.upsertDashboard({ id: uuid, dnt: cookieDNT });
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
      //   return redirect(new URL(`/dashboard`, WORKER_DOMAIN), {
      //     headers: [['Set-Cookie', mkLoginCookie(newId)]],
      //   });
      // }
      default: break;
    }
  } else if (method !== 'GET') return r.badRequest();

  const storePassword = html`<button type="submit" class="bp3-button bp3-minimal bp3-small" style="display:inline-block">Store Password</button>`;

  return page({ hostname: dashboard.hostname, isBookmarked, headers: setHeaders })(html`
    <div class="bp3-running-text">
      <div class="row">

      <div>
        <h3>Domain</h3>
        ${dashboard.hostname != null ? '' : html`
          <div class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
            <h4 class="bp3-heading">Please set a domain</h4>
            You can change this later. 
            Once you've set a domain, Clap Button will show and persist claps on all pages within that domain.
          </div>
        `}
        <form method="POST" action="/settings">
          <input type="hidden" name="method" value="domain"/>
          <div class="bp3-input-group" style="display:inline-block; width:16rem">
            <span class="bp3-icon bp3-icon-globe-network"></span>
            <input type="url" class="bp3-input" name="hostname" placeholder="https://example.com" value="https://" required/>
          </div>
          <button class="bp3-button" type="submit">Set domain</button>
          ${showError ? html`<div class="bp3-callout bp3-intent-danger">Someone is already using that domain!</div>` : ''}
        </form>
        ${dashboard.hostname ? html`<p style="margin-top:.5rem">Your current domain is: <strong>${dashboard.hostname}</strong></p>` : ''}
      </div>

      ${dashboard.hostname == null ? html`<div></div>` : html`<div>
      <h3>Key</h3>
      <form id="login" method="POST" action="/login" class="bp3-inline" autocomplete="on">
        <input type="hidden" name="referrer" value="/settings"/>
        <input type="text" class="bp3-input" name="id" value="${dashboard.hostname}" hidden readonly autocomplete="username" />
        <div class="bp3-input-group" style="display:inline-block; width:16rem">
          <span class="bp3-icon bp3-icon-key"></span>
          <input type="password" class="bp3-input" name="password" value="${id}" readonly autocomplete="new-password" />
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
        <p style="margin-top:.5rem" class="unlock ${dashboard.hostname == null || !isBookmarked ? 'hidden' : ''}">
           Clicking the ${storePassword} button will trigger your browser's password manager. 
           Use it to store the key to this dashboard.
           <br/><small style="display:inline-block;margin-top:.5rem;">If you've already stored the key, clicking the button will have no effect.</small>
        </p>
        ${isBookmarked ? '' : html`
        <div id="bookmark-warning" class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
          <h4 class="bp3-heading">Please store your credentials!</h4>
          Please use your browser's password manager to store the credentials.<br/>
          Use the ${storePassword} button to trigger your browsers store password dialog.
        </div>`}
      </form>
      <script type="module">
        if ('PasswordCredential' in window) {
          document.querySelectorAll('form#login button[type=submit]').forEach(el => el.addEventListener('click', async (e) => {
            e.preventDefault();
            const cred = new PasswordCredential(document.querySelector('form#login'));
            await navigator.credentials.store(cred);
            document.cookie = '${mkBookmarkedCookie(dashboard.hostname)}';
            if (document.querySelector('#bookmark-warning')) document.querySelector('#bookmark-warning').remove();
            document.querySelectorAll('.unlock').forEach(el => { el.classList.remove('hidden') });
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
      </div>
      `}
      </div>

      <div class="row">
      <div class="unlock ${dashboard.hostname == null || !isBookmarked ? 'hidden' : ''}">
        <h3>Self-Tracking</h3>
        <form method="POST" action="/settings">
          <input type="hidden" name="method" value="dnt"/>
          <label class="bp3-control bp3-switch bp3-large" style="margin-top:.5rem;">
            <input type="checkbox" name="dnt" ${cookieDNT ? 'checked' : ''}/>
            <span class="bp3-control-indicator"></span>
            Don't track myself
          </label>
          <p>
            Use this option to prevent browsing your own site from distorting statistics.
            <br/><small style="display:inline-block;margin-top:.5rem;">
              Setting this option will set a cookie that will cause all page views from this browser to be ignored,
              as well as all page views from the last IP address that accessed this dashboard.
            </small>
          </p>
          ${dashboard.ip ? html`<p><small>Last login from: <code>${dashboard.ip}</code></small></p>` : ''}
          <script>document.querySelector('input[name="dnt"]').addEventListener('change', function(e) { setTimeout(function () { e.target.form.submit() }, 500) })</script>
          <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
        </form>
      </div>
      <div></div>
      </div>
    `);
}
