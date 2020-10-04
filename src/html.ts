import { filterXSS } from 'xss';
import { join, interleave, map, aMap, aInterleaveFlattenSecond } from './iter';

type Repeatable<T> = T | T[];
type Awaitable<T> = T | Promise<T>;
type Callable<T> = T | (() => T);
type DataTypes = undefined | boolean | number | string | BigInt | Symbol;

type Renderable = null | DataTypes | HTML | UnsafeHTML | Fallback;
type Content = Repeatable<Awaitable<Repeatable<Renderable>>>;
export type HTMLContent = Callable<Content>;

export async function* stream2AsyncIterable<T>(stream: ReadableStream<T>): AsyncIterable<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally { reader.releaseLock() }
}

export function asyncIterable2Stream<T>(asyncIterable: AsyncIterable<T>): ReadableStream<T> {
  const { readable, writable } = new TransformStream();
  (async () => {
    const writer = writable.getWriter();
    try {
      for await (const x of asyncIterable) writer.write(x);
    } finally { writer.close() }
  })();
  return readable;
}

async function* unpackContent(arg: Content): AsyncIterableIterator<string> {
  const x = await arg;
  if (Array.isArray(x)) for (const xi of x) yield* unpackContent(xi);
  else if (x instanceof HTML) yield* x;
  else if (x instanceof UnsafeHTML) yield x.value;
  else if (x instanceof Fallback) try {
    yield* unpack(x.content)
  } catch (e) {
    yield* typeof x.fallback === 'function'
      ? x.fallback(e)
      : x.fallback;
  }
  else yield filterXSS(x as string);
}

async function* unpack(arg: HTMLContent): AsyncIterableIterator<string> {
  try {
    yield* unpackContent(typeof arg === 'function' ? arg() : arg);
  } catch (err) {
    if (err instanceof HTML) yield* err;
    else throw err;
  }
}

export class HTML {
  strings: TemplateStringsArray;
  args: HTMLContent[];

  constructor(strings: TemplateStringsArray, args: HTMLContent[]) {
    this.strings = strings;
    this.args = args;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<string> {
    const stringsIt = this.strings[Symbol.iterator]();
    const argsIt = this.args[Symbol.iterator]();
    while (true) {
      const { done: stringDone, value: string } = stringsIt.next();
      if (stringDone) break;
      else yield string;

      const { done: argDone, value: arg } = argsIt.next();
      if (argDone) break;
      else yield* unpack(arg);
    }
  }

  // [Symbol.asyncIterator]() {
  //   return aInterleaveFlattenSecond(this.strings, map(aHelper)(this.args));
  // }
}

export function html(strings: TemplateStringsArray, ...args: HTMLContent[]) {
  return new HTML(strings, args);
}

export function css(strings: TemplateStringsArray, ...args: HTMLContent[]) {
  return new HTML(strings, args);
}

export class HTMLResponse extends Response {
  constructor(html: HTML, init?: ResponseInit) {
    const encoder = new TextEncoder();
    const htmlGenerator = aMap((str: string) => encoder.encode(str))(html);
    super(asyncIterable2Stream(htmlGenerator), init);
    this.headers.set('Content-Type', 'text/html;charset=UTF-8');
  }
}

export class UnsafeHTML {
  value: string;
  constructor(value: string) { this.value = value }
  toString() { return this.value }
  toJSON() { return this.value }
}

class Fallback {
  content: HTMLContent;
  fallback: HTML | ((e: any) => HTML);
  constructor(content: HTMLContent, fallback: HTML | ((e: any) => HTML)) {
    this.content = content;
    this.fallback = fallback;
  }
}

export function fallback(content: HTMLContent, fallback: HTML | ((e: any) => HTML)) {
  return new Fallback(content, fallback);
}

export function unsafeHTML(content: string) {
  return new UnsafeHTML(content);
}
