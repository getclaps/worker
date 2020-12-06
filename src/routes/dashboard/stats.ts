import { UUID } from 'uuid-class';
import { fallback, html, HTMLContent } from '@werker/html';

import { TimeUnit } from '../../dao';
import { countriesByCode } from '../../vendor/countries';
import { DashboardArgs, mkHostnameCookieKey } from '../dashboard';
import { page } from './page';
import { pURL, noOpener, mkRef } from './lib';
import { elongateId, shortenId } from '../../short-id';

const withFallback = (c: HTMLContent) => fallback(c, (err) => html`<div>Something went wrong: ${err.message}</div>`);

export const htmlTimeFrameSelect = (timeFrames: string[], selectedTimeFrame: string) => {
  return html`
    <div class="bp3-select" style="margin-right:5px">
      <select name="time">
        ${timeFrames.map(tf => html`<option ${tf === selectedTimeFrame ? 'selected' : ''} value="${tf}">${tf.split('-').join(' ')}</option>`)}
        ${!timeFrames.includes(selectedTimeFrame)
          ? html`<option selected value="${selectedTimeFrame}">${'---'}</option>`
          : ''}
      </select>
    </div>
  `;
}

export const htmlHostnameSelect = (cookies: Map<string, string>, uuid: UUID) => {
  const shortIds = cookies.get('ids')?.split(',') ?? [];
  return html`
    <div class="bp3-select" style="margin-right:5px">
      <select name="host">
        ${shortIds.map(async shortId => html`<option ${shortId === shortenId(uuid) ? 'selected' : ''} value="${shortId}">${cookies.get(await mkHostnameCookieKey(shortId)) ?? shortId}</option>`)}
      </select>
    </div>`;
}

export async function statsPage({ requestURL, dao, isBookmarked, locale, cookies }: DashboardArgs) {
  const timeFrame = requestURL.searchParams.get('time') || '24-hours';
  const [value, unit] = timeFrame.split('-') as [string, TimeUnit];
  const uniquenessWarning = !['hours', 'minutes', 'seconds'].includes(unit);

  const selectedUUID = elongateId(requestURL.searchParams.get('host') ?? cookies.get('did'));

  // const d = dao.getDashboard(uuid);
  const x = dao.getStats(selectedUUID, [Number(value), unit]);

  return page({ isBookmarked })(html`
    <div class="bp3-running-text" style="padding-top:40px">
      ${/*<h2>Stats</h2>*/''}
      <form method="GET" action="/stats">
        <label class="bp3-label bp3-inline" style="display:inline-block; margin-bottom:2rem">
          Show data for the last
          ${htmlTimeFrameSelect(['12-hours', '24-hours', '7-days', '30-days'], timeFrame)}
          <span> on </span>
          ${htmlHostnameSelect(cookies, selectedUUID)}
          <script>document.querySelector('select[name=time]').addEventListener('change', function(e) { e.target.form.submit() });</script>
          <script>document.querySelector('select[name=host]').addEventListener('change', function(e) { e.target.form.submit() });</script>
          <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
        </label>
      </form>
      <div class="stats-card bp3-card bp3-elevation-2">
        <dl class="stats">
          <dt>Unique visitors${uniquenessWarning ? html`<sup>1</sup>`: ''}</dt>
          <dd><strong>${withFallback(x.then(x => x.visitors.toLocaleString(locale)))}</strong></dd>

          <dt>Total page views</dt>
          <dd><strong>${withFallback(x.then(x => x.totalViews.toLocaleString(locale)))}</strong></dd>

          <dt>Total claps</dt>
          <dd><strong>${withFallback(x.then(x => x.totalClaps.toLocaleString(locale)))}</strong></dd>
        </dl>
      </div>
      ${uniquenessWarning
        ? html`<ol style="margin-top:1rem"><li>For privacy reasons, uniqueness of visitors is only established within a single 24 hour frame.<br/>
          Returning visitors are counted again for each returning day.</li></ol>` 
        : ''}
      <div class="row">
        <div class="col">
          <h3>Views by page</h3>
          <table class="stats bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Page</th>
                <th style="text-align:right">Views</th>
              </tr>
            </thead>
            <tbody>
              ${withFallback(x.then(x => x.views.slice(0, 16).map((stat) => html`
                <tr>
                  <td style="width:30px">${noOpener(stat.href)}</td>
                  <td title="${pURL(stat.href)?.href}" class="ellipsis" style="width:65%">${pURL(stat.href)?.pathname}</td>
                  <td style="text-align:right">${stat.views.toLocaleString(locale)}</td>
                </tr>`)))}
            </tbody>
          </table>
        </div>
        <div class="col">
          <h3>Claps by page</h3>
          <table class="stats bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Page</th>
                <th style="text-align:right">Claps (Unique)</th>
              </tr>
            </thead>
            <tbody>
              ${withFallback(x.then(x => x.claps.slice(0, 16).map((stat) => html`
                <tr>
                  <td style="width:30px">${noOpener(stat.href)}</td>
                  <td title="${pURL(stat.href)?.href}" class="ellipsis" style="width:65%">${pURL(stat.href)?.pathname}</td>
                  <td style="text-align:right">${stat.claps.toLocaleString(locale)} (${stat.clappers.toLocaleString(locale)})</td>
                </tr>`)))}
            </tbody>
          </table>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <h3>Top countries</h3>
          <table class="stats bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Country</th>
                <th style="text-align:right">Views</th>
              </tr>
            </thead>
            <tbody>
              ${withFallback(x.then(x => x.countries.slice(0, 16).map((stat) => html`
                <tr>
                  <td style="width:30px">${countriesByCode[stat.country]?.emoji ??''}</td>
                  <td class="ellipsis" style="width:65%">${countriesByCode[stat.country]?.name ?? stat.country}</td>
                  <td style="text-align:right">${stat.views.toLocaleString(locale)}</td>
                </tr>`)))}
            </tbody>
          </table>
        </div>
        <div class="col">
          <h3>Top referrers</h3>
          <table class="stats bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
            <thead>
              <tr>
                <th></th>
                <th>Referrer</th>
                <th style="text-align:right">Referrals</th>
              </tr>
            </thead>
            <tbody>
              ${withFallback(x.then(x => x.referrals.slice(0, 16).map((stat) => html`
                <tr>
                  <td style="width:30px">${noOpener(stat.referrer)}</td>
                  <td title="${pURL(stat.referrer)?.href}" class="ellipsis" style="width:65%">${mkRef(stat.referrer)}</td>
                  <td style="text-align:right">${stat.referrals.toLocaleString(locale)}</td>
                </tr>`)))}
            </tbody>
          </table>
          <p>
            If the <a href="https://en.wikipedia.org/wiki/HTTP_referer" target="_blank"><code>Referrer</code></a> of a page view is known, it will be shown here. Direct traffic and empty referrers are omitted.<br/>
            <small style="display:inline-block;margin-top:.5rem">
              Note that many popular sites will remove the referrer when linking to your site, 
              but you can add it back by adding a <code>referrer</code> search parameter to your link. 
              ${/*E.g.: <span style="white-space:nowrap;text-decoration:underline">https://${d.then(d => d.hostname[0] || 'your-site.com')}/linked-page/?referrer=popularsite.com</span>*/''}
            </small>
          </p>
        </div>
      </div>
    </div>
  `);
}
