import { Awaitable } from "../router";

export const withCORS = <T extends { event: FetchEvent }>(handler: (args: T) => Awaitable<Response>) => async (args: T): Promise<Response> => {
  const request = args.event.request;
  const response = await handler(args);

  response.headers.set('access-control-allow-origin', request.headers.get('origin'));
  if (request.headers.has('access-control-request-method')) response.headers.set('access-control-allow-methods', request.headers.get('access-control-request-method'));
  if (request.headers.has('access-control-request-headers')) response.headers.set('access-control-allow-headers', request.headers.get('access-control-request-headers'));
  response.headers.set('access-control-allow-credentials', 'true');

  return response;
}
