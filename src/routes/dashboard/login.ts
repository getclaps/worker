import * as re from '@werker/response-creators';
import { html } from '@werker/html';

import { WORKER_DOMAIN } from '../../constants';
import { router } from '../../router';
import { DAO } from '../../dao';
import { getDAO } from '../../dao/get-dao';
import { elongateId } from '../../short-id';

import * as cc from '../cookies';
import { page } from './common';

router.get('/logout', async ({ headers }) => {
  const cookies = cc.parseCookie(headers.get('cookie'));

  const did = cookies.get('did');
  const ids = cookies.get('ids')?.split(',')?.filter(_ => _ !== did) ?? [];
  return re.seeOther(new URL(`/`, WORKER_DOMAIN), {
    headers: [
      ['Set-Cookie', ids.length ? cc.mkLoginCookie(ids[0]) : cc.mkLogoutCookie()],
      ['Set-Cookie', cc.mkLogoutsCookie(cookies, cookies.get('did'))],
    ],
  });
})

router.post('/login', async ({ request, headers }) => {
  const dao: DAO = getDAO();
  const cookies = cc.parseCookie(headers.get('cookie'));

  const formData = await request.formData()
  const id = formData.get('password').toString();
  const hostname = formData.get('id')?.toString();
  const referrer = (formData.get('referrer') || request.headers.get('referer') || '/').toString();

  try {
    const uuid = elongateId(id);
    const d = await dao.getDashboard(uuid);
    if (!d) throw Error();
  } catch {
    return re.seeOther(new URL(referrer, WORKER_DOMAIN))
  }

  return re.seeOther(new URL(referrer, WORKER_DOMAIN), {
    headers: [
      ['Set-Cookie', cc.mkLoginCookie(id)],
      ['Set-Cookie', cc.mkLoginsCookie(cookies, id)],
      ['Set-Cookie', await cc.mkBookmarkedCookie(id)],
      ...hostname ? [['Set-Cookie', await cc.mkHostnameCookie(id, hostname)]] : [],
    ],
  });
});

router.get('/login', ({ headers }) => {
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
      </form>
    </div>
    <script type="module">
      if ('PasswordCredential' in window) (async () => {
        const cred = await navigator.credentials.get({ password: true });
        if (cred) {
          const { id, password } = cred;
          const body = new URLSearchParams(Object.entries({ id, password }));
          const referrer = new FormData(document.getElementById('login')).get('referrer');
          document.getElementById('login').querySelectorAll('input, button').forEach(el => { el.disabled = true });
          const response = await fetch('/login', { method: 'POST', body, redirect: 'manual' });
          if (referrer) window.location.assign(referrer);
          else window.location.reload();
        }
      })();
    </script>
  `);
});
