import { notAcceptable, unsupportedMediaType } from '@werker/response-creators';
import negotiated from 'negotiated';

import { Awaitable } from '../common-types';
import { BaseArg } from '.';

const weightSortFn = <X extends { weight: number }>(a: X, b: X) => a.weight >= b.weight ? a : b;

export interface ContentNegotiationOptions<
  T extends readonly string[],
  L extends readonly string[],
  E extends readonly string[],
  C extends readonly string[],
  AT extends readonly string[],
  AL extends readonly string[],
  AE extends readonly string[],
  AC extends readonly string[]
  > {
  /** The content types _provided_ by this endpoint. Not to be confused with `accepts`. */
  types?: T,

  /** The languages provided by this endpoint */
  languages?: L,

  /** The encodings provided by this endpoint */
  encodings?: E,

  /** The character sets provided by this endpoint */
  charsets?: C,

  /** The body content types _acceptable_ to this endpoint. Not to be confused with `types`. */
  accepts?: AT,

  /** The languages (of the request body) _acceptable_ to this endpoint. Not to be confused with `languages`. */
  acceptsLanguages?: AL,

  /** The body encodings _acceptable_ to this endpoint. Not to be confused with `encodings`. */
  acceptsEncodings?: AE,

  /** The body charsets _acceptable_ to this endpoint. Not to be confused with `charsets`. */
  acceptsCharsets?: AC,
}

export interface ContentNegotiationResults<
  T extends readonly string[],
  L extends readonly string[],
  E extends readonly string[],
  C extends readonly string[],
  AT extends readonly string[],
  AL extends readonly string[],
  AE extends readonly string[],
  AC extends readonly string[]
  > {
  /** The best content type _acceptable to the client_. */
  type: T[number] | null,

  /** The best language _acceptable to the client_. */
  language: L[number] | null,

  /** The best encoding _acceptable to the client_. */
  encoding: E[number] | null,

  /** The best charset _acceptable to the client_. */
  charset: C[number] | null,

  /** The request's `Content-Type` header if (and only if) accepted by this endpoint */
  accepted: AT[number] | null,

  /** The request's `Language` header if (and only if) accepted by this endpoint */
  acceptedLanguage: AL[number] | null,

  /** The request's `Encoding` header if (and only if) accepted by this endpoint */
  acceptedEncoding: AE[number] | null,

  /** The request's `Charset` header if (and only if) accepted by this endpoint */
  acceptedCharset: AC[number] | null,
}

/**
 * @example
 * withContentNegotiation({ 
 *   accepts: [mime.FORM, mime.FORM_DATA], 
 *   types: [mime.HTML, mime.JSON], 
 * })(async ({ request, type }) => {
 *   const data = await request.formData();
 *   if (type === mime.HTML) {
 *     return new HTMLResponse();
 *   }
 *   if (type === mime.JSON) {
 *     return new JSONResponse();
 *   }
 * }); 
 */
export const withContentNegotiation = <
  T extends readonly string[],
  L extends readonly string[],
  E extends readonly string[],
  C extends readonly string[],
  AT extends readonly string[],
  AL extends readonly string[],
  AE extends readonly string[],
  AC extends readonly string[],
>(opts: ContentNegotiationOptions<T, L, E, C, AT, AL, AE, AC> = {}) =>
  <A extends BaseArg>(handler: (args: A & ContentNegotiationResults<T, L, E, C, AT, AL, AE, AC>) => Awaitable<Response>) =>
    async (args: A): Promise<Response> => {
      const headers = args.event.request.headers;

      const {
        types,
        languages,
        encodings,
        charsets,
        accepts,
        acceptsLanguages,
        acceptsEncodings,
        acceptsCharsets,
      } = opts;

      const { type: accepted } = [...negotiated.mediaTypes(headers.get('content-type'))]?.[0] ?? { type: null };
      const { language: acceptedLanguage } = [...negotiated.languages(headers.get('language'))]?.[0] ?? { language: null };
      const { encoding: acceptedEncoding } = [...negotiated.encodings(headers.get('encoding'))]?.[0] ?? { encoding: null };
      const { charset: acceptedCharset } = [...negotiated.charsets(headers.get('charset'))]?.[0] ?? { charset: null };

      if (accepts?.length && !accepts.includes(accepted)) return unsupportedMediaType();
      if (acceptsLanguages?.length && !acceptsLanguages.includes(acceptedLanguage)) return notAcceptable();
      if (acceptsEncodings?.length && !acceptsEncodings.includes(acceptedEncoding)) return notAcceptable();
      if (acceptsCharsets?.length && !acceptsCharsets.includes(acceptedCharset)) return notAcceptable();

      const neverT = { weight: -1, type: null as T[number] | null };
      const neverL = { weight: -1, language: null as L[number] | null };
      const neverE = { weight: -1, encoding: null as E[number] | null };
      const neverC = { weight: -1, charset: null as C[number] | null };

      const { type } = [...negotiated.mediaTypes(headers.get('accept'))]
        .filter(t => !types || types.includes(t.type))
        .reduce(weightSortFn, neverT);

      const { language } = [...negotiated.languages(headers.get('accept-language'))]
        .filter(l => !languages || languages.includes(l.language))
        .reduce(weightSortFn, neverL);

      const { encoding } = [...negotiated.encodings(headers.get('accept-encoding'))]
        .filter(e => !encodings || encodings.includes(e.encoding))
        .reduce(weightSortFn, neverE);

      const { charset } = [...negotiated.charsets(headers.get('accept-charset'))]
        .filter(c => !charsets || charsets.includes(c.charset))
        .reduce(weightSortFn, neverC);

      if (headers.has('accept') && types && !type) return notAcceptable();
      if (headers.has('accept-language') && languages && !language) return notAcceptable();
      if (headers.has('accept-encoding') && encodings && !encoding) return notAcceptable();
      if (headers.has('accept-charset') && charsets && !charset) return notAcceptable();

      const response = await handler({
        ...args,
        type,
        language,
        encoding,
        charset,
        accepted,
        acceptedLanguage,
        acceptedEncoding,
        acceptedCharset,
      });

      // If the server accepts more than 1 option, we set the vary header for correct caching
      if (types?.length ?? 0 > 1) response.headers.append('Vary', 'Accept');
      if (languages?.length ?? 0 > 1) response.headers.append('Vary', 'Accept-Language');
      if (encodings?.length ?? 0 > 1) response.headers.append('Vary', 'Accept-Encoding');
      if (charsets?.length ?? 0 > 1) response.headers.append('Vary', 'Accept-Charset');

      return response;
    };
  
export { withContentNegotiation as withCN };
