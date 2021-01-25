import { Awaitable } from "../common-types";

export type BaseArg = { event: FetchEvent }
export type BaseHandler = (arg: BaseArg) => Awaitable<Response>;
export type Handler<A extends BaseArg> = (arg: A) => Awaitable<Response>;

/**
 * @example
 *   self.addEventListener('fetch', adapt(withCORS()(withContentNegotiation()((async () => {
 *     return ok();
 *   })))));
 */
export const adapt = (handler: BaseHandler) => (event: FetchEvent) => handler({ event });

export * from './cookies';
export * from './session';
export * from './content-negotiation';
export * from './cors';