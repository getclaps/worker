class LocationPolyfill implements Location {
  #url: URL;
  constructor(href: string) {
    this.#url = new URL(href);
  }
  get ancestorOrigins(): DOMStringList { throw new Error('Getter not implemented.') };
  get hash(): string { return '' };
  get host(): string { return this.#url.host };
  get hostname(): string { return this.#url.hostname };
  get href(): string { return this.#url.href };
  get origin(): string { return this.#url.origin };
  get pathname(): string { return '' };
  get port(): string { return this.#url.port };
  get protocol(): string { return this.#url.protocol };
  get search(): string { return '' };
  assign(_url: string): void {
    throw new Error("Method not implemented.");
  }
  reload(): void;
  reload(_forcedReload: boolean): void;
  reload(_forcedReload?: any) {
    throw new Error("Method not implemented.");
  }
  replace(_url: string): void {
    throw new Error("Method not implemented.");
  }
  toString(): string {
    return this.href;
  }
}

if (!('location' in self)) {
  if (Reflect.get(self, 'WORKER_LOCATION')) {
    self.location = new LocationPolyfill(Reflect.get(self, 'WORKER_LOCATION'));
  } else {
    self.addEventListener('fetch', polyfillLocation);
  }
}

function polyfillLocation(event: FetchEvent): void {
  // self.removeEventListener('fetch', <any>polyfillLocation);
  self.location = new LocationPolyfill(event.request.url);
}