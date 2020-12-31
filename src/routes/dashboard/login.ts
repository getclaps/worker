import * as re from '@werker/response-creators';
import { html } from '@werker/html';

import { withCookies } from '../../vendor/middleware/cookie-store';

import { router } from '../../router';
import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { parseUUID } from '../../vendor/short-id';

import * as cc from '../cookies';
import { page } from './components';

// const withCookies = withSignedCookies({ secret: 'foobar' });

router.post('/login', withCookies(async ({ request, cookies, cookieStore }) => {
  const dao: DAO = getDAO();

  const formData = await request.formData()
  const id = formData.get('password').toString();
  const hostname = formData.get('id')?.toString();
  const referrer = (formData.get('referrer') || request.headers.get('referer') || '/').toString();

  try {
    const uuid = parseUUID(id);
    const d = await dao.getDashboard(uuid);
    if (!d) throw Error();
  } catch {
    return re.seeOther(referrer)
  }

  await Promise.all([
    cookieStore.set(cc.loginsCookie(cookies, id)),
    cookieStore.set(cc.loginCookie(id)),
    cookieStore.set(await cc.bookmarkedCookie(id)),
    ...hostname ? [cookieStore.set(await cc.hostnameCookie(id, hostname))] : [],
  ]);

  return re.seeOther(referrer);
}));

// TODO: make POST
router.get('/logout', withCookies(async ({ cookies, cookieStore }) => {
  const did = cookies.get('did');
  const ids = cookies.get('ids').split(',').filter(_ => _ !== did) ?? [];

  await Promise.all([
    cookieStore.set(cc.logoutsCookie(cookies)),
    ...ids.length
      ? [cookieStore.set(cc.loginCookie(ids[0]))] 
      : [cookieStore.delete('did')]
  ]);

  return re.seeOther('/');
}));


router.get('/login', withCookies(({ headers }) => {
  const referrer = headers.get('referer');
  return page()(html`
    <div class="flex-center" style="margin-top:3rem">
      <form id="login" method="POST" action="/login" class="bp3-inline" autocomplete="on">
        ${referrer ? html`<input type="hidden" name="referrer" value="${referrer}" />` : null}
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
            const referrer = new FormData(form).get('referrer');
            document.getElementById('login').querySelectorAll('input, button').forEach(el => { el.disabled = true });
            const response = await fetch('/login', { method: 'POST', body, redirect: 'manual' });
            if (referrer) window.location.assign(referrer);
            else window.location.reload();
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
}));
