import sanitize from 'sanitize-html';
import { join, interleave, map, aMap, aInterleaveFlattenSecond } from './iter';

type Repeatable<T> = T|T[];
type Awaitable<T> = T|Promise<T>;

export class UnsafeHTML {
  value: string;
  constructor(value: string) { this.value = value }
  toString() { return this.value }
  toJSON() { return this.value }
}

export function unsafeHTML(safeHTML: string) {
  return new UnsafeHTML(safeHTML)
}

function helper(x: any) {
  if (x == null) return '';
  if (Array.isArray(x)) return x.map(helper).join('');
  if (x instanceof UnsafeHTML) return x.value;
  return sanitize(x);
}

export function css(strings: TemplateStringsArray, ...args: any[]) {
  return new UnsafeHTML(join(interleave(strings, args.map(helper))));
}

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

type BaseArg = undefined|null|string|number|boolean|UnsafeHTML|HTML;
export type Arg = Awaitable<Repeatable<BaseArg>>;

async function* aHelper(arg: Arg): AsyncIterableIterator<string> {
  const x = await arg;
  if (Array.isArray(x)) for (const xi of x) yield* aHelper(xi);
  else if (x instanceof HTML) yield* x;
  else if (x instanceof UnsafeHTML) yield x.value;
  else yield sanitize(x);
}

export class HTML {
  strings: TemplateStringsArray;
  args: Arg[];

  constructor(strings: TemplateStringsArray, args: Arg[]) { 
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
      else yield* aHelper(arg);
    }
  }

  // [Symbol.asyncIterator]() {
  //   return aInterleaveFlattenSecond(this.strings, map(aHelper)(this.args));
  // }
}

export function html(strings: TemplateStringsArray, ...args: Arg[]) {
  return new HTML(strings, args);
}

export class HTMLResponse extends Response {
  constructor(body: HTML, init?: ResponseInit) {
    const encoder = new TextEncoder();
    const encodeFn = aMap((str: string) => encoder.encode(str));
    super(asyncIterable2Stream(encodeFn(body)), init);
    this.headers.set('Content-Type', 'text/html;charset=UTF-8');
  }
}
