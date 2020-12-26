import * as re from '@werker/response-creators';
import { DEBUG } from '../constants';
import * as er from '../errors';
import { Awaitable } from '../router';

export function handleError(err: any) {
  if (err instanceof Response) return err;
  if (err instanceof er.NotFoundError) return re.notFound(err.message);
  if (err instanceof er.PaymentRequiredError) return re.paymentRequired(err.message);
  if (err instanceof er.ConflictError) return re.conflict(err.message);
  if (err instanceof er.BadRequestError) return re.badRequest(err.message);
  if (DEBUG) throw err;
  return re.internalServerError();
}

export const withErrors = <T extends { event: FetchEvent }>(handler: (args: T) => Awaitable<Response>) => async (args: T): Promise<Response> => {
  try {
    return await handler(args);
  } catch (err) {
    return handleError(err);
  }
}
