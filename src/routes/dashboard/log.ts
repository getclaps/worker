import { html, HTMLContent, fallback } from '@werker/html';
import { renderIconSVG } from '@download/blockies';
import { formatDistance } from 'date-fns';
import { Base64Encoder } from 'base64-encoding';

import { countriesByCode } from '../../vendor/countries';
import { TimeUnit } from '../../dao';
import { DashboardArgs } from '../dashboard';
import { page } from './page';
import { pURL, noOpener, mkRef } from './lib';

const withFallback = (c: HTMLContent) => fallback(c, (err) => html`<tr>
  <td></td>
  <td>Something went wrong: ${err?.message ?? ''}</td>
  <td></td>
  <td></td>
  <td></td>
</tr>`);
 
export async function logPage({ dao, isBookmarked, uuid, locale, requestURL }: DashboardArgs) {
  const timeFrame = requestURL.searchParams.get('time') || '1-hour';
  const [valueString, unit] = timeFrame.split('-') as [string, TimeUnit];
  const value = Number(valueString)

  const d = dao.getDashboard(uuid);

  return page({ isBookmarked })(html`
    <div class="bp3-running-text" style="padding-top:40px">
      <form method="GET" action="/log">
        <label class="bp3-label bp3-inline" style="display:inline-block; margin-bottom:2rem">
          Show data for the last
          <div class="bp3-select" style="margin-right:5px">
            <select name="time">
              <option ${timeFrame === '1-hour'   ? 'selected' : ''} value="1-hour">1 hour</option>
              <option ${timeFrame === '2-hours'  ? 'selected' : ''} value="2-hours">2 hours</option>
              <option ${timeFrame === '6-hours'  ? 'selected' : ''} value="6-hours">6 hours</option>
              <option ${timeFrame === '12-hours' ? 'selected' : ''} value="12-hours">12 hours</option>
              <option ${timeFrame === '24-hours' ? 'selected' : ''} value="24-hours">24 hours</option>
              ${!['1-hour', '2-hours', '6-hours', '12-hours', '24-hours'].includes(timeFrame)
                ? html`<option selected value="${timeFrame}">---</option>`
                : ''}
            </select>
          </div>
          <span> on </span>
          <strong>${fallback(d.then(d => d.hostname[0] || 'your-site.com'), html``)}</strong>
          <script>document.querySelector('select[name=time]').addEventListener('change', function(e) { e.target.form.submit() })</script>
          <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
        </label>
      </form>
      <table class="stats bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
        <thead>
          <tr>
            <th></th>
            <th>Href</th>
            <th>Referrer</th>
            <th>Time ago</th>
            <th>Country</th>
            <th>Visitor</th>
            <th style="text-align:right">Claps</th>
          </tr>
        </thead>
        <tbody>
          ${async () => {
            try {
              const logEntries = await dao.getLog(uuid, [Number(value), unit]);
              const now = new Date();
              return logEntries.filter(x => x && x.href != null).map(entry => withFallback(() => {
                const seed = new Base64Encoder().encode(entry.visitor);
                const img = `data:image/svg+xml;base64,${btoa(renderIconSVG({ seed, size: 8, scale: 2 }))}`;
                const emoji = countriesByCode[entry.country]?.emoji ?? '';
                const url = pURL(entry.href);
                return html`<tr>
                  <td>${noOpener(entry.href)}</td>
                  ${url 
                    ? html`<td title="${url.href}" style="width:32.5%">${url.pathname + url.hash}</td>` 
                    : html`<td style="width:32.5%"></td>`}
                  ${entry.referrer 
                    ? html`<td title="${pURL(entry.referrer).href}" style="width:32.5%">${mkRef(entry.referrer)}</td>` 
                    : html`<td style="width:32.5%"></td>`}
                  <td style="width:15%">${entry.ts ? formatDistance(entry.ts, now) : ''}</td>
                  <td><span title="${countriesByCode[entry.country]?.name ?? entry.country}">${emoji}</span></td>
                  <td><img class="identicon" src="${img}" alt="${seed.slice(0, 7)}" width="16" height="16"/></td>
                  <td style="text-align:right">${entry.claps?.toLocaleString(locale) ?? ''}</td>
                </tr>`; 
              }));
            } catch (e) {
              return html`<div>Something went wrong: ${e?.message}</div>`
            }
          }}
        </tbody>
      </table>
    </div>
  `);
}
