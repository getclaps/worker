import { notAcceptable } from '@werker/response-creators';
import negotiated from 'negotiated';

export interface ContentNegotiationOptions {
  types?: string[],
  languages?: string[],
  encodings?: string[],
  charsets?: string[],
}

export interface ContentNegotiationResults {
  type: string | null,
  language: string | null,
  encoding: string | null,
  charset: string | null,
}

const weightFn = <T extends { weight: number }>(a: T, b: T) => a.weight >= b.weight ? a : b;

export const withContentNegotiation =
  (opts: ContentNegotiationOptions = {}) =>
    <T extends { event: FetchEvent }>(handler: (args: T & ContentNegotiationResults) => Promise<Response>) =>
      async (args: T): Promise<Response> => {
        const headers = args.event.request.headers;

        const { types, languages, encodings, charsets } = opts;

        const { type } = [...negotiated.mediaTypes(headers.get('accept'))]
          .filter(t => !types || types.includes(t.type))
          .reduce(weightFn, { type: null, weight: -1 });

        const { language } = [...negotiated.languages(headers.get('accept-language'))]
          .filter(l => !languages || languages.includes(l.language))
          .reduce(weightFn, { language: null, weight: -1 });

        const { encoding } = [...negotiated.encodings(headers.get('accept-encoding'))]
          .filter(e => !encodings || encodings.includes(e.encoding))
          .reduce(weightFn, { encoding: null, weight: -1 });

        const { charset } = [...negotiated.charsets(headers.get('accept-charset'))]
          .filter(c => !charsets || charsets.includes(c.charset))
          .reduce(weightFn, { charset: null, weight: -1 });

        if (headers.has('accept') && types && !type) return notAcceptable();
        if (headers.has('accept-language') && languages && !language) return notAcceptable();
        if (headers.has('accept-encoding') && encodings && !encoding) return notAcceptable();
        if (headers.has('accept-charset') && charsets && !charset) return notAcceptable();

        const response = await handler({ ...args, type, language, encoding, charset });

        // If the server accepts more than 1 option, we set the vary header for correct caching
        if (types?.length > 1) response.headers.append('vary', 'accept');
        if (languages?.length > 1) response.headers.append('vary', 'accept-language');
        if (encodings?.length > 1) response.headers.append('vary', 'accept-encoding');
        if (charsets?.length > 1) response.headers.append('vary', 'accept-charset');

        return response;
      };