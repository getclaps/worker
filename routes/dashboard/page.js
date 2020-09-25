import { html, HTML } from '../../html';
import { styles } from './styles';

/**
 * @param {{ title?: string, hostname?: string, isBookmarked?: boolean, headers?: HeadersInit }} [param0]
 * @returns {(content: () => any) => Response}
 */
export const page = ({ title = 'getclaps.dev', hostname = null, isBookmarked = false, headers = [] } = {}) => (content) => new Response(html`
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
            <a href="/" style="text-decoration:none">
              <h1 style="font-size:1rem">${title}</h1>
            </a>
          </div>
        </div>
        <div class="bp3-navbar-group unlock ${hostname == null || !isBookmarked ? 'hidden' : ''}">
          <!-- <a class="bp3-button bp3-minimal" href="/stats">Stats</a> -->
          <a class="bp3-button bp3-minimal" href="/subscription">Subscription</a>
          <a class="bp3-button bp3-minimal" href="/settings">Settings</a>
          <span class="bp3-navbar-divider"></span>
          <a class="bp3-button bp3-minimal" href="/logout">Logout</a>
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
      ${content()}
    </main>
    </div>
  </body>
</html>`, {
  headers: [
    ...new Headers(headers),
    ['Content-Type', 'text/html;charset=UTF-8'],
    ['X-Robots-Tag', 'noindex'],
  ],
});
