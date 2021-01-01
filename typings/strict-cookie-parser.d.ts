declare module 'strict-cookie-parser' {
  export function parseCookieHeader(h: string): Map<string, string> | null
  export function parseCookiePair(p: string): { name: string, value: string } | null
  export function isCookieName(n: string): boolean
  export function parseCookieValue(v: string): string | null
}