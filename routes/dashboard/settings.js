import * as r from '../../response-types';
import { html } from '../../html';
import { page } from './page';

import { mkDNTCookie, mkDNTCookieKey } from '../dashboard';

/** @param {import('../dashboard').Snowball} param0 */
export async function settingsPage({ method, uuid, dashboard, cookies, request, dao, isBookmarked }) {
  let cookieDNT = cookies.has(mkDNTCookieKey(dashboard.hostname));
  let setHeaders = new Headers();

  if (method === 'POST') {
    const fd = await request.formData();
    switch (fd.get('method')) {
      case 'dnt': {
        cookieDNT = fd.get('dnt') === 'on'
        setHeaders.append('Set-Cookie', mkDNTCookie(cookieDNT, dashboard.hostname));
        await dao.upsertDashboard({ id: uuid, dnt: cookieDNT });
        break;
      }
      default: break;
    }
  } else if (method !== 'GET') return r.badRequest();

  return page({ hostname: dashboard.hostname, isBookmarked })(html`
      <div class="bp3-running-text">
        <h2>Settings</h2>
        <form method="POST" action="/settings">
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
      </div>
    `);
}
