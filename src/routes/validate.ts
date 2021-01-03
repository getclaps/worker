import * as er from '../errors';

// A non-empty scheme component followed by a colon (:),
// consisting of a sequence of characters beginning with a letter and 
// followed by any combination of letters, digits, plus (+), period (.), or hyphen (-).
const RE_PROTOCOL = /^[a-z][a-z0-9.+-]*:/i;

export const validateURL = (url?: string | null) => {
  try {
    if (!url) throw new er.BadRequestError('No url provided')
    if (url.length > 4096) throw new er.BadRequestError('URL too long. 4096 characters max.');
    const withProtocol = url.match(RE_PROTOCOL) ? url : `https://${url}`;
    const targetURL = new URL(withProtocol);
    targetURL.search = '';
    return targetURL;
  } catch {
    throw new er.BadRequestError('Invalid or missing URL');
  }
}
