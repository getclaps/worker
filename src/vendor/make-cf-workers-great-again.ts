import '@worker-tools/event-target-polyfill';
import { resolvablePromise, ResolvablePromise } from './resolvable-promise';

const et = new EventTarget();

Object.defineProperty(self, 'addEventListener', {
  writable: false,
  enumerable: false,
  configurable: false,
  value: et.addEventListener.bind(et),
});

Object.defineProperty(self, 'removeEventListener', {
  writable: false,
  enumerable: false,
  configurable: false,
  value: et.removeEventListener.bind(et),
});

Object.defineProperty(self, 'dispatchEvent', {
  writable: false,
  enumerable: false,
  configurable: false,
  value: et.dispatchEvent.bind(et),
});

class RealFetchEvent extends Event implements FetchEvent {
  private __request: Request;
  private __promise: ResolvablePromise<Response>;
  private __waitUntil: (promise: Promise<any>) => void;
  private __passThroughOnException: () => void;

  constructor(type: string, eventInitDict?: FetchEventInit);
  constructor(
    request: Request, 
    promise: ResolvablePromise<Response>, 
    waitUntil: (promise: Promise<any>) => void,
    passThroughOnException: () => void
  );
  constructor(
    request: string | Request, 
    promise?: ResolvablePromise<Response> | FetchEventInit, 
    waitUntil?: (promise: Promise<any>) => void,
    passThroughOnException?: () => void
  ) {
    super('fetch');
    if (typeof request === 'string' || !(promise instanceof Promise) || !waitUntil || !passThroughOnException) {
      throw Error('Overload not implemented');
    }
    this.__request = request;
    this.__promise = promise;
    this.__waitUntil = waitUntil;
    this.__passThroughOnException = passThroughOnException;
  }

  get clientId(): string { return '' };
  get preloadResponse(): Promise<any> { return Promise.resolve() };
  get replacesClientId(): string { return '' };
  get request(): Request { return this.__request };
  get resultingClientId(): string { return '' };

  respondWith(r: Response | Promise<Response>): void {
    this.__promise.resolve(r);
  }

  waitUntil(f: any): void {
    this.__waitUntil(f);
  }

  passThroughOnException = () => {
    this.__passThroughOnException();
  };
}

Object.defineProperty(self, 'FetchEvent', {
  writable: false,
  enumerable: false,
  configurable: false,
  value: RealFetchEvent,
});

class RealScheduledEvent extends Event implements ScheduledEvent {
  private __scheduledTime: number;
  private __waitUntil: (promise: Promise<any>) => void;

  constructor(scheduledTime: number, waitUntil: (promise: Promise<any>) => void) {
    super('scheduled');
    this.__scheduledTime = scheduledTime;
    this.__waitUntil = waitUntil;
  }

  get scheduledTime(): number {
    return this.__scheduledTime;
  };

  waitUntil(promise: Promise<any>): void {
    this.__waitUntil(promise);
  }
}

Object.defineProperty(self, 'ScheduledEvent', {
  writable: false,
  enumerable: false,
  configurable: false,
  value: RealScheduledEvent,
});

export default {
  fetch(request: Request, env: any, ctx: any) {
    Object.assign(self, env);

    const promise = resolvablePromise<Response>();
    self.dispatchEvent(new RealFetchEvent(
      request,
      promise,
      ctx.waitUntil.bind(ctx),
      ctx.passThroughOnException.bind(ctx),
    ));

    return promise;
  },

  scheduled(scheduledTime: number, env: any) {
    Object.assign(self, env);

    const promises = [Promise.resolve()];

    self.dispatchEvent(new RealScheduledEvent(
      scheduledTime,
      p => promises.push(p),
    ));

    return Promise.all(promises);
  },
}
