import { html } from '@werker/html';

export const pURL = (href?: string|null) => {
  let url: URL;
  try { url = new URL(href) } catch { return null }
  return url;
};

export const noOpener = (href: string) => {
  const url = pURL(href);
  return url ? html`<a href="${url.href}" target="_blank" rel="noreferrer noopener" class="opener">
    <span class="bp3-icon bp3-icon-share"></span>
  </a>` : '';
}

export const mkRef = (href: string) => {
  const url = pURL(href);
  if (!url) return '';
  url.protocol = 'x:';
  return url.href.substr(4);
};