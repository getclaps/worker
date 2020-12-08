import { html } from '@werker/html';

export const parseURL = (href?: string|null) => {
  let url: URL;
  try { url = new URL(href) } catch { return null }
  return url;
};

export const noOpener = (href: string) => {
  const url = parseURL(href);
  return url ? html`<a href="${url.href}" target="_blank" rel="noreferrer noopener" class="opener">
    <span class="bp3-icon bp3-icon-share"></span>
  </a>` : '';
}

export const mkRef = (href: string) => {
  const url = parseURL(href);
  if (!url) return '';
  url.protocol = 'x:';
  return url.href.substr(4);
};

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
