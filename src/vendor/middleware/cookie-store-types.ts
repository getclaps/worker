export interface CookieStore extends EventTarget {
  get(name?: string): CookieListItem | null;
  // get(options?: CookieStoreGetOptions): CookieListItem | null;

  getAll(name: string): CookieList;
  // getAll(options?: CookieStoreGetOptions): CookieList;

  set(name: string, value: string): void;
  set(options: CookieInit): void;

  delete(name: string): void;
  // delete(options: CookieStoreDeleteOptions): void;
}

export interface CookieStoreGetOptions {
  name?: string;
  url?: string;
}

export type CookieSameSite = "strict" | "lax" | "none";

export interface CookieInit {
  name: string;
  value?: string;
  expires?: number | Date | null;
  domain?: string | null;
  path?: string;
  sameSite?: CookieSameSite;
  httpOnly?: boolean,
}

export interface CookieStoreDeleteOptions {
  name: string;
  domain?: string | null;
  path: string;
}

export interface CookieListItem {
  name: string;
  value: string;
  domain?: string | null;
  path?: string;
  expires?: Date | null;
  secure?: boolean;
  sameSite?: CookieSameSite;
}

export type CookieList = CookieListItem[];
