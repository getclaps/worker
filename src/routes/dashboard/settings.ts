import { html } from '@werker/html';

import { RequestCookieStore } from '../../vendor/middleware/cookies';

import { Dashboard } from '../../dao';
import { ConflictError } from '../../errors';
import { router, DashboardArgs } from '../../router';
import * as cc from '../cookies';
import { withDashboard } from './with-dashboard';
import { page } from './components';
import { validateURL } from '../validate';
import { UUID } from 'uuid-class';
import { shortenId } from '../../vendor/short-id';
import { storage } from '../../constants';

const storePassword = html`<button type="submit" class="bp3-button bp3-minimal bp3-small" style="display:inline-block">Store Password</button>`;

async function settingsPage(
  { uuid, id, cookies, session, dao, isBookmarked }: DashboardArgs, 
  { dashboard, cookieDNT, showError }: {
    dashboard?: Required<Dashboard> | null, 
    cookieDNT?: boolean, 
    showError?: boolean,
    isBookmarked?: boolean,
  } = {},
) {
  dashboard = dashboard || await dao.getDashboard(uuid);
  if (!dashboard) throw Error();

  const hn = dashboard.hostname[0];
  cookieDNT = cookieDNT ?? (hn ? cookies.has(cc.dntCookieKey(hn)) : false)

  if (hn) session.hostnames.set(id, hn);

  return page({ dir: 'settings', session, uuid, isBookmarked })(html`
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
                  <ul>${dashboard.hostname.map((h, i, hns) =>
                    html`<li>
                      ${i === 0 
                        ? html`<strong>${h}</strong>` 
                        : h}
                      ${hns.length > 1 
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
              document.querySelector('input[name=password] + button').addEventListener('click', e => { 
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
              <br/><small style="display:inline-block;margin-top:.5rem;">If you've already stored the key, clicking the button will have no effect.</small>
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
                if (document.querySelector('#bookmark-warning')) document.querySelector('#bookmark-warning').remove();
                document.querySelectorAll('.unlock').forEach(el => { el.classList.remove('hidden') });
                const body = new URLSearchParams(Object.entries({ id: '${hn}', password: '${id}' }));
                await fetch('/login', { method: 'POST', body, headers: { accept: 'application/json' } });
              }));
            }
          </script>
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
            ${cookieDNT 
               ? html`<p><small>Last login from: <code>${storage.get<string[]>(hn)?.then(x => x[0])}</code></small></p>`
               : ''}
            <script>
              document.querySelector('input[name="dnt"]').addEventListener('change', e => setTimeout(() => e.target.form.submit(), 500))
            </script>
            <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
          </form>
        </div>
        <div class="unlock ${dashboard.hostname.length === 0 || !isBookmarked ? 'hidden' : ''}">
          <h3>Reset Key</h3>
          <form method="POST" action="/settings">
            <input type="hidden" name="method" value="relocate" />
            <p>If you've accidentally published your dashboard key, you can invalidate it here:</p>
            <button class="bp3-button bp3-intent-danger" type="submit">Reset Key</button>
            <label class="bp3-control bp3-checkbox" style="margin-top:.5rem">
              <input type="checkbox" name="okay" required />
              <span class="bp3-control-indicator"></span>
              I understand that the current key will be invalid after resetting.
            </label>
          </form>
        </div>
      </div>
      <script>document.cookie = '${RequestCookieStore.toSetCookie(cc.dntCookie(cookieDNT, dashboard.hostname[0]))}';</script>
    `);
}

router.get('/settings', withDashboard(settingsPage))
router.post('/settings', withDashboard(async (args) => {
  const { request, dao, uuid, cookieStore, session } = args;

  let showError = false;
  let dashboard: Required<Dashboard> | undefined;
  let cookieDNT: boolean | undefined;

  const fd = await request.formData();
  
  switch (fd.get('method')) {
    case 'domain': {
      try {
        dashboard = await dao.appendDomain(uuid, validateURL(fd.get('hostname')?.toString()).hostname);
      } catch (err) {
        if (err instanceof ConflictError) { showError = true } else throw err;
      }
      break;
    }
    case 'delete-domain': {
      try {
        dashboard = await dao.removeDomain(uuid, validateURL(fd.get('hostname')?.toString()).hostname);
      } catch (err) {
        if (err instanceof ConflictError) { showError = true } else throw err;
      }
      break;
    }
    case 'dnt': {
      cookieDNT = fd.get('dnt') === 'on'
      const md = await dao.getDashboard(uuid);
      if (md) {
        dashboard = md;
        const hn = dashboard.hostname[0];
        await cookieStore.set(cc.dntCookie(cookieDNT, hn));
        args.cookies = new Map((await cookieStore.getAll()).map(({ name: n, value: v }) => [n, v]));
      }
      break;
    }
    case 'relocate': {
      const oldUUID = uuid;
      const newUUID = args.uuid = UUID.v4();
      const oldId = shortenId(oldUUID);
      const newId = args.id = shortenId(newUUID);
      dashboard = await dao.relocateDashboard(oldUUID, newUUID);
      session.cid = newId;
      session.ids = session.ids.map(id => id === oldId ? newId : id);
      session.hostnames.set(newId, session.hostnames.get(oldId) ?? newId);
      session.hostnames.delete(oldId);
      session.bookmarked.delete(oldId)
      args.isBookmarked = false;
      // if ((globalThis as any).hasBilling) {
      //   const newId = shortenId(newUUID);
      //   await stripeAPI(`/v1/subscriptions/${dashboard.subscription}`, {
      //     method: 'POST',
      //     data: { 'metadata[dashboard_id]': newId },
      //   });
      //   // cookies.set(cc.loginCookie(newId));
      //   // return re.seeOther(`/dashboard`);
      // }
      break;
    }
    default: break;
  }
  return settingsPage(args, { dashboard, cookieDNT, showError });
}));
