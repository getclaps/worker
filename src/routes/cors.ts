import { Awaitable } from "../vendor/common-types";

const ORIGIN = 'origin';
const METHOD = 'access-control-request-method';
const HEADERS = 'access-control-request-headers';

export const withCORS = <A extends { event: FetchEvent }>(handler: (args: A) => Awaitable<Response>) => async (args: A): Promise<Response> => {
  const { headers } = args.event.request;

  const response = await handler(args);

  response.headers.set('access-control-allow-origin', headers.get(ORIGIN));
  if (headers.has(METHOD)) response.headers.set('access-control-allow-methods', headers.get(METHOD));
  if (headers.has(HEADERS)) response.headers.set('access-control-allow-headers', headers.get(HEADERS));
  response.headers.set('access-control-allow-credentials', 'true');

  return response;
}
