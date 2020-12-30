import { BaseArg, Handler } from ".";
import { Awaitable } from "../common-types";

const ORIGIN = 'origin';
const REQUEST_METHOD = 'access-control-request-method';
const REQUEST_HEADERS = 'access-control-request-headers';
const ALLOW_ORIGIN = 'access-control-allow-origin';
const ALLOW_METHODS = 'access-control-allow-methods';
const ALLOW_HEADERS = 'access-control-allow-headers';
const ALLOW_CREDENTIALS = 'access-control-allow-credentials';

interface CORSOptions {
  origin?: string | URL,
  credentials?: boolean;
}

/**
 * A CORS middleware that gives clients exactly the permissions they ask for.
 */
export const withCORS = (opt: CORSOptions = {}) => <A extends BaseArg>(handler: Handler<A>) => async (args: A): Promise<Response> => {
  const req = args.event.request;
  const res = await handler(args);

  const origin = typeof opt.origin === 'string' 
    ? new URL(opt.origin) 
    : opt.origin;

  if (!res.headers.has(ALLOW_ORIGIN)) 
    res.headers.set(ALLOW_ORIGIN, origin?.origin ?? req.headers.get(ORIGIN));

  if (!res.headers.has(ALLOW_METHODS) && req.headers.has(REQUEST_METHOD)) 
    res.headers.set(ALLOW_METHODS, req.headers.get(REQUEST_METHOD));

  if (!res.headers.has(ALLOW_HEADERS) && req.headers.has(REQUEST_HEADERS))
    res.headers.set(ALLOW_HEADERS, req.headers.get(REQUEST_HEADERS));

  if (!res.headers.has(ALLOW_CREDENTIALS) && opt.credentials) 
    res.headers.set(ALLOW_CREDENTIALS, 'true');

  return res;
}
