import { notAcceptable } from '@werker/response-creators';
import negotiated from 'negotiated';

import { BaseArg } from '.';

const weightSortFn = <X extends { weight: number }>(a: X, b: X) => a.weight >= b.weight ? a : b;

export interface ContentNegotiationOptions<
  T extends readonly string[],
  L extends readonly string[],
  E extends readonly string[],
  C extends readonly string[]> {
  types?: T,
  languages?: L,
  encodings?: E,
  charsets?: C,
}

export interface ContentNegotiationResults<
  T extends readonly string[],
  L extends readonly string[],
  E extends readonly string[],
  C extends readonly string[]> {
  type: T[number] | null,
  language: L[number] | null,
  encoding: E[number] | null,
  charset: C[number] | null,
}

export const withContentNegotiation = <
  T extends readonly string[],
  L extends readonly string[],
  E extends readonly string[],
  C extends readonly string[]>(opts: ContentNegotiationOptions<T, L, E, C> = {}) =>
  <A extends BaseArg>(handler: (args: A & ContentNegotiationResults<T, L, E, C>) => Promise<Response>) =>
    async (args: A): Promise<Response> => {
      const headers = args.event.request.headers;

      const { types, languages, encodings, charsets } = opts;

      const { type } = <{ type: T[number] }>
        [...negotiated.mediaTypes(headers.get('accept'))]
          .filter(t => !types || types.includes(t.type))
          .reduce(weightSortFn, { type: null, weight: -1 });

      const { language } = <{ language: L[number] }>
        [...negotiated.languages(headers.get('accept-language'))]
          .filter(l => !languages || languages.includes(l.language))
          .reduce(weightSortFn, { language: null, weight: -1 });

      const { encoding } = <{ encoding: E[number] }>
        [...negotiated.encodings(headers.get('accept-encoding'))]
          .filter(e => !encodings || encodings.includes(e.encoding))
          .reduce(weightSortFn, { encoding: null, weight: -1 });

      const { charset } = <{ charset: C[number] }>
        [...negotiated.charsets(headers.get('accept-charset'))]
          .filter(c => !charsets || charsets.includes(c.charset))
          .reduce(weightSortFn, { charset: null, weight: -1 });

      if (headers.has('accept') && types && !type) return notAcceptable();
      if (headers.has('accept-language') && languages && !language) return notAcceptable();
      if (headers.has('accept-encoding') && encodings && !encoding) return notAcceptable();
      if (headers.has('accept-charset') && charsets && !charset) return notAcceptable();

      const response = await handler({ ...args, type, language, encoding, charset });

      // If the server accepts more than 1 option, we set the vary header for correct caching
      if (types?.length > 1) response.headers.append('Vary', 'Accept');
      if (languages?.length > 1) response.headers.append('Vary', 'Accept-Language');
      if (encodings?.length > 1) response.headers.append('Vary', 'Accept-Encoding');
      if (charsets?.length > 1) response.headers.append('Vary', 'Accept-Charset');

      return response;
    };
