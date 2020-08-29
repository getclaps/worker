import { html } from '../../html';
import { page } from './page';
import * as r from '../../response-types';

import { mkDNTCookie, mkDNTCookieKey, mkBookmarkedCookie } from '../dashboard';

/** @param {import('../dashboard').Snowball} param0 */
export async function homePage({ method, request, isBookmarked, dashboard, cookies, dao, uuid, id }) {
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

  return page({ hostname: dashboard.hostname, id, isBookmarked, headers: setHeaders })(html`
    <div class="bp3-running-text">
      ${dashboard.hostname == null ? '' : html`<h2>Key</h2>
      <form id="login" method="POST" action="/login" class="bp3-inline" autocomplete="on">
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
        ${isBookmarked 
            ? html`<p style="margin-top:.5rem">
           Clicking the ${storePassword} button will trigger your browser's password manager. 
           Use it to store the key to this dashboard. 
           If you've already stored the key, clicking the button will have no effect.
          </p>` 
            : html`<div id="bookmark-warning" class="bp3-callout bp3-intent-warning bp3-icon-warning-sign" style="margin-bottom:1rem;">
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
      <form method="POST" action="/">
        <input type="hidden" name="method" value="domain"/>
        <div class="bp3-input-group" style="display:inline-block; width:16rem">
          <span class="bp3-icon bp3-icon-globe-network"></span>
          <input type="url" class="bp3-input" name="hostname" placeholder="https://example.com" value="https://" required/>
        </div>
        <button class="bp3-button" type="submit">Set domain</button>
        ${showError ? `<div class="bp3-callout bp3-intent-danger">Someone is already using that domain!</div>` : ''}
      </form>
    `);
}