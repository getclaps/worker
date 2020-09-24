import { html } from '../../html';
import { page } from './page';

import { countries } from '../../countries.js';

const countriesByCode = Object.fromEntries(countries.map(x => [x.code, x]));

const noOpener = href => {
  let url;
  try { url = new URL(href) } catch { return '' }
  return html`<a href="${url.href}" target="_blank" rel="noreferrer noopener" class="opener"><span class="bp3-icon bp3-icon-share"></span></a></td>`;
}

/** @param {import('../dashboard').Snowball} param0 */
export async function statsPage({ requestURL, dao, isBookmarked, uuid, locale }) {
  const timeFrame = requestURL.searchParams.get('time') || '24-hours';
  const [value, unit] = timeFrame.split('-');

  console.time('getStats');
  const {
    dashboard,
    visitors,
    views,
    claps,
    countries,
    referrals,
    totalClaps,
    totalViews,
  } = await dao.getStats(uuid, [Number(value), unit]);
  console.timeEnd('getStats');

  return page({ hostname: dashboard.hostname, isBookmarked })(html`
    <div class="bp3-running-text">
      <h2>Stats</h2>
      <form method="GET" action="/stats">
        <label class="bp3-label bp3-inline">
          Show data for the last
          <div class="bp3-select">
            <select name="time">
              <option ${timeFrame === '12-hours' ? 'selected' : ''} value="12-hours">12 hours</option>
              <option ${timeFrame === '24-hours' ? 'selected' : ''} value="24-hours">24 hours</option>
              <option ${timeFrame === '7-days' ? 'selected' : ''} value="7-days">7 days</option>
              <option ${timeFrame === '30-days' ? 'selected' : ''} value="30-days">30 days</option>
            </select>
          </div>
          <script>document.querySelector('select[name=time]').addEventListener('change', function(e) { e.target.form.submit() })</script>
          <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
        </label>
      </form>
      <div class="stats-card bp3-card bp3-elevation-2">
        <dl class="stats">
          <dt>Unique visitors</dt><dd><strong>${visitors.toLocaleString(locale)}</strong></dd>
          <dt>Total page views</dt><dd><strong>${totalViews.toLocaleString(locale)}</strong></dd>
          <dt>Total claps</dt><dd><strong>${totalClaps.toLocaleString(locale)}</strong></dd>
        </dl>
      </div>
      <div class="row">
        <div class="col">
          <h3>Top pages <small>by views</small></h3>
          <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Page</th>
                <th>Views</th>
              </tr>
            </thead>
            <tbody>
              ${views.slice(0, 16).map(stat => html`
                <tr>
                  <td>${noOpener(stat.href)}</td>
                  <td title="${new URL(stat.href).href}">${new URL(stat.href).pathname}</td>
                  <td>${stat.views.toLocaleString(locale)}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
        <div class="col">
          <h3>Top pages <small>by claps</small></h3>
          <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Page</th>
                <th>Claps</th>
                <th>Clappers</th>
              </tr>
            </thead>
            <tbody>
              ${claps.slice(0, 16).map(stat => html`
                <tr>
                  <td>${noOpener(stat.href)}</td>
                  <td title="${new URL(stat.href).href}">${new URL(stat.href).pathname}</td>
                  <td>${stat.claps.toLocaleString(locale)}</td>
                  <td>${stat.clappers.toLocaleString(locale)}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <h3>Top countries</h3>
          <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Country</th>
                <th>Views</th>
              </tr>
            </thead>
            <tbody>
              ${countries.slice(0, 16).map((stat) => html`
                <tr>
                  <td>${(countriesByCode[stat.country] || {}).emoji || ''}</td>
                  <td>${(countriesByCode[stat.country] || {}).name || stat.country}</td>
                  <td>${stat.views.toLocaleString(locale)}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
        <div class="col">
          <h3>Top referrers</h3>
          <table class="bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Referrer</th>
                <th>Referrals</th>
              </tr>
            </thead>
            <tbody>
              ${referrals.slice(0, 16).map((stat) => html`
                <tr>
                  <td>${noOpener(stat.referrer)}</td>
                  <td title="${new URL(stat.referrer).href}">${new URL(stat.referrer).href}</td>
                  <td>${stat.referrals.toLocaleString(locale)}</td>
                </tr>`)}
            </tbody>
          </table>
          <p>
            If the <a href="https://en.wikipedia.org/wiki/HTTP_referer" target="_blank"><code>Referrer</code></a> of a page view is known, it will be shown here. Direct traffic and empty referrers are omitted.<br/>
            <small style="display:inline-block;margin-top:.5rem">
              Note that many popular sites will remove the referrer when linking to your site, 
              but you can add it back by adding a <code>referrer</code> search parameter to your link, e.g.:
              <span style="white-space:nowrap;text-decoration:underline">https://${dashboard.hostname || 'your-site.com'}/linked-page/?referrer=popularsite.com</span>
            </small>
          </p>
        </div>
      </div>
    </div>
  `);
}
