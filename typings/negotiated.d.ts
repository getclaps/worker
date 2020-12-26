declare module 'negotiated' {
  export function mediaTypes(h: string): IterableIterator<{ type: string, params: string, weight: number, extensions: string }>
  export function charsets(h: string): IterableIterator<{ charset: string, weight: number }>
  export function encodings(h: string): IterableIterator<{ encoding: string, weight: number }>
  export function languages(h: string): IterableIterator<{ language: string, weight: number }>
  export function transferEncodings(h: string): IterableIterator<{ encoding: string, params: string, weight: number }>
  export function parameters(p: string): IterableIterator<{ encoding: string, params: string, weight: number }>
}
