import { Awaitable } from "../common-types";

export type BaseArg = { event: FetchEvent }
export type BaseHandler = (arg: BaseArg) => Awaitable<Response>;
export type Handler<A extends BaseArg> = (arg: A) => Awaitable<Response>;

export const adapt = (handler: BaseHandler) => (event: FetchEvent) => handler({ event });

export * from './cookie-store';
export * from './session-store';
export * from './content-negotiation';
export * from './cors';