import * as re from '@werker/response-creators';
import { html } from '@werker/html';

import { withCookies } from '../../vendor/middleware/cookies';

import { router } from '../../router';
import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { parseUUID } from '../../vendor/short-id';

import { page } from './components';
import { dashSession } from './with-dashboard';
import { withContentNegotiation } from '../../vendor/middleware';
import { JSONResponse } from '@werker/json-fetch';

// const withCookies = withSignedCookies({ secret: 'foobar' });

router.post('/login', withCookies(dashSession(withContentNegotiation({ types: ['application/json', 'text/html']})(async ({ request, session, type }) => {
  const dao: DAO = getDAO();

  const formData = await request.formData()
  const id = formData.get('password').toString();
  const hostname = formData.get('id')?.toString();
  const ref = (formData.get('referer') || request.headers.get('referer')).toString();
  const location = ref.endsWith('/login') ? '/stats' : ref;

  const uuid = parseUUID(id);
  const dash = await dao.getDashboard(uuid);
  if (!dash) {
    // Incorret password
    throw Error();
  }

  session.cid = id;
  if (!session.ids.includes(id)) session.ids.push(id);
  session.bookmarked.add(id);
  if (hostname) session.hostnames.set(id, hostname);

  if (type === 'text/html') {
    return re.seeOther(location)
  } 
  if (type === 'application/json') {
    return new JSONResponse({ location });
  }
}))));

// TODO: make POST
router.get('/logout', withCookies(dashSession(async ({ session }) => {
  const cid = session.cid;
  const ids = session.ids.filter(id => id !== cid);

  session.ids = ids;
  if (ids.length) {
    session.cid = ids[0];
  } else {
    delete session.cid;
  }

  return re.seeOther('/');
})));


router.get('/login', ({ headers }) => {
  const referrer = headers.get('referer');
  return page()(html`
    <div class="flex-center" style="margin-top:3rem">
      <form id="login" method="POST" action="/login" class="bp3-inline" autocomplete="on">
        ${referrer ? html`<input type="hidden" name="referer" value="${referrer}" />` : null}
        <div class="bp3-form-group">
          <label class="bp3-label" for="form-group-input">
            Key
          </label>
          <div class="bp3-form-content">
            <div class="bp3-input-group" style="width:16rem">
              <span class="bp3-icon bp3-icon-key"></span>
              <input type="password" class="bp3-input" name="password" autofocus autocomplete="current-password" required />
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
        <button class="bp3-button" hidden>Open Credentials Manager</button>
      </form>
    </div>
    <script type="module">
      if ('PasswordCredential' in window) {
        async function openCredentialsManager(e) {
          if (e) e.preventDefault();
          const cred = await navigator.credentials.get({ password: true });
          if (cred) {
            const { id, password } = cred;
            const body = new URLSearchParams(Object.entries({ id, password }));
            document.getElementById('login').querySelectorAll('input, button').forEach(el => { el.disabled = true });
            const response = await fetch('/login', { method: 'POST', body, headers: { accept: 'application/json' } });
            if (response.ok) 
              window.location.assign((await response.json()).location);
            else 
              window.location.reload();
          }
        }
        openCredentialsManager();
        const form = document.getElementById('login');
        const btn2 = form.querySelector('button[hidden]');
        btn2.hidden = false;
        btn2.addEventListener('click', openCredentialsManager);
      }
    </script>
  `);
});
