import { page } from './page';
import { html } from '../../html';

export function loginPage() {
  // const response = fetch('/dashboard/login', { method: 'POST', redirect });b
  return page()(html`
    <div class="flex-center" style="margin-top:3rem">
      <form id="login" method="POST" action="/dashboard/login" class="bp3-inline" autocomplete="on">
        <div class="bp3-form-group">
          <label class="bp3-label" for="form-group-input">
            Key
            <span class="bp3-text-muted">(required)</span>
          </label>
          <div class="bp3-form-content">
            <div class="bp3-input-group" style="width:16rem">
              <span class="bp3-icon bp3-icon-key"></span>
              <input type="password" class="bp3-input" name="password" autocomplete="current-password" required />
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
          const body = new URLSearchParams(Object.entries({ method: 'login', id, password }));
          const response = await fetch('/dashboard/login', { method: 'POST', body, redirect: 'manual' });
          // cookie set, reload page
          window.location.reload();
        }
      })();
    </script>
  `)
}
