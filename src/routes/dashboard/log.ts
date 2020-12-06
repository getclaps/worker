import { html, HTMLContent, fallback } from '@werker/html';
import { renderIconSVG } from '@download/blockies';
import { formatDistance } from 'date-fns';
import { Base64Encoder } from 'base64-encoding';

import { countriesByCode } from '../../vendor/countries';
import { TimeUnit } from '../../dao';
import { DashboardArgs } from '../dashboard';
import { page } from './page';
import { pURL, noOpener, mkRef, htmlTimeFrameSelect } from './lib';
import { elongateId } from '../../short-id';

const withFallback = (c: HTMLContent) => fallback(c, (err) => html`<tr>
  <td></td>
  <td>Something went wrong: ${err?.message ?? ''}</td>
  <td></td>
  <td></td>
  <td></td>
</tr>`);
 
export async function logPage({ dao, isBookmarked, cookies, uuid, locale, requestURL }: DashboardArgs) {
  const timeFrame = requestURL.searchParams.get('time') || '1-hour';
  const [valueString, unit] = timeFrame.split('-') as [string, TimeUnit];
  const value = Number(valueString);

  // const d = dao.getDashboard(uuid);

  return page({ dir: 'log', isBookmarked, cookies, uuid })(html`
    <div class="bp3-running-text" style="padding-top:40px">
      <form id="log-query" method="GET" action="/log">
        <label class="bp3-label bp3-inline" style="display:inline-block; margin-bottom:2rem">
          Show data for the last
          ${htmlTimeFrameSelect(['1-hour', '2-hours', '6-hours', '12-hours', '24-hours'], timeFrame)}
          <script>document.querySelectorAll('#log-query select').forEach(el => el.addEventListener('change', e => e.target.form.submit()))</script>
          <noscript><button class="bp3-button" type="submit">Submit</button></noscript>
        </label>
      </form>
      <table class="stats bp3-html-table bp3-html-table-striped bp3-html-table-condensed" style="margin-bottom:2rem">
        <thead>
          <tr>
            <th></th>
            <th>Href</th>
            <th></th>
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
              const logEntries = await dao.getLog(uuid, [value, unit]);
              const now = new Date();
              return logEntries.filter(x => x && x.href != null).map(entry => withFallback(() => {
                const seed = new Base64Encoder().encode(entry.visitor);
                const img = `data:image/svg+xml;base64,${btoa(renderIconSVG({ seed, size: 8, scale: 2 }))}`;
                const emoji = countriesByCode[entry.country]?.emoji ?? '';
                const url = pURL(entry.href);
                return html`<tr>
                  <td style="width:30px">${noOpener(entry.href)}</td>
                  ${url 
                    ? html`<td title="${url.href}" class="ellipsis" style="width:40%">${url.pathname + url.hash}</td>` 
                    : html`<td style="width:40%"></td>`}
                  <td style="width:30px">${noOpener(entry.referrer)}</td>
                  ${entry.referrer 
                    ? html`<td title="${pURL(entry.referrer).href}" class="ellipsis" style="width:25%">${mkRef(entry.referrer)}</td>` 
                    : html`<td style="width:25%"></td>`}
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
