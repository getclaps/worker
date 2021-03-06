import { html, HTMLContent, HTMLResponse } from '@worker-tools/html';
import { UUID } from 'uuid-class';
import { DashboardSession } from '../../router';

import { styles } from './styles';

export const page = ({ dir = 'stats', title = 'getclaps.dev', isBookmarked = false, headers = [], session }: {
  dir?: string,
  title?: string,
  isBookmarked?: boolean,
  headers?: HeadersInit,
  session?: DashboardSession,
  uuid?: UUID,
} = {}) => (content: HTMLContent) => new HTMLResponse(html`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>${title}</title>
    <meta name="robots" content="noindex">
    <link href="https://unpkg.com/normalize.css/normalize.css" rel="stylesheet"/>
    <link href="https://unpkg.com/@blueprintjs/icons/lib/css/blueprint-icons.css" rel="stylesheet"/>
    <link href="https://unpkg.com/@blueprintjs/core/lib/css/blueprint.css" rel="stylesheet"/>
    <style>${styles}</style>
  </head>
  <body>
    <nav class="bp3-navbar" style="position:fixed; top:0;">
      <div>
        <div class="bp3-navbar-group bp3-align-left">
          <div class="bp3-navbar-heading" style="font-weight:bold">
            <a href="/" style="text-decoration:none">
              <h1 style="font-size:1rem"><img src="https://getclaps.dev/assets/img/logo.svg" alt="${title}" style="width:32px;height:32px"/></h1>
            </a>
          </div>
        </div>
        <div class="bp3-navbar-group bp3-align-left unlock ${!isBookmarked ? 'hidden' : ''}">
          <a class="bp3-button bp3-minimal ${dir === 'stats' ? 'bp3-active' : ''}" href="/stats">Stats</a>
          <a class="bp3-button bp3-minimal ${dir === 'log' ? 'bp3-active' : ''}" href="/log">Log</a>
          <a class="bp3-button bp3-minimal ${dir === 'settings' ? 'bp3-active' : ''}" href="/settings">Settings</a>
          ${(globalThis as any).hasBilling ? html`
            <span class="bp3-navbar-divider"></span>
            <a class="bp3-button bp3-minimal ${dir === 'subscription' ? 'bp3-active' : ''}" href="/subscription">Subscription</a>
          ` : ''}
        </div>
        <div class="bp3-navbar-group bp3-align-right unlock ${!isBookmarked ? 'hidden' : ''}">
          <form id="switch" method="POST" action="/login" autocomplete="off" style="margin-right:5px">
            <div class="bp3-control-group">
              ${session ? htmlHostnameSelect(session) : ''}
              <a class="bp3-button bp3-icon-add" title="Add account" href="/login"></a>
            </div>
            <script>document.querySelectorAll('#switch select').forEach(el => el.addEventListener('change', e => e.target.form.submit()))</script>
            <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
          </form>
          <a class="bp3-button bp3-minimal bp3-icon-log-out" href="/logout">Logout</a>
          <script type="module">
            if ('PasswordCredential' in window) (() => {
              document.querySelectorAll('a[href="/logout"]').forEach(el => el.addEventListener('click', () => {
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
</html>`, {
  headers: [
    ...new Headers(headers),
    ['X-Robots-Tag', 'noindex'],
  ],
});

export const htmlHostnameSelect = (session: DashboardSession, { modifiers = '' }: { modifiers?: string } = {}) => {
  return html`
    <div class="bp3-select ${modifiers}">
      <select name="password">
        ${session.ids.map(sid => html`
        <option value="${sid}" ${sid === session.cid ? 'selected' : ''}>
          ${session.hostnames.get(sid) ?? sid}
        </option>
        `)}
      </select>
    </div>`;
}
