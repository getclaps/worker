import sanitize from 'sanitize-html';

/**
 * @template X
 * @template Y
 * @param {Iterable<X>} xs 
 * @param {Iterable<Y>} ys 
 * @returns {IterableIterator<X | Y>}
 */
function* interleave(xs, ys) {
  const itx = xs[Symbol.iterator]();
  const ity = ys[Symbol.iterator]();
  while (true) {
    const rx = itx.next();
    if (rx.done) break;
    else yield rx.value;
    const ry = ity.next();
    if (ry.done) break;
    else yield ry.value;
  }
}

// /**
//  * @template A
//  * @template B
//  * @param {(a: A) => B} f 
//  * @param {Iterable<A>|AsyncIterable<A>} forAwaitable 
//  */
// async function* map(f, forAwaitable) {
//   for await (const x of forAwaitable) yield f(x);
// }

/** @param {Iterable<String>} xs */
const join = (xs) => [...xs].join('');

export class UnsafeHTML {
  /** @param {string} value */
  constructor(value) { this.value = value }
  toString() { return this.value }
  toJSON() { return this.value }
}

/** @param {string} safeHTML */
export function unsafeHTML(safeHTML) {
  return new UnsafeHTML(safeHTML)
}

/** @param {any} x @return {string} */
function helper(x) {
  if (!x) return '';
  if (Array.isArray(x)) return x.map(helper).join('');
  if (x instanceof UnsafeHTML) return x.value;
  return sanitize(x);
}

/**
 * @param {TemplateStringsArray} strings 
 * @param {...any} args 
 */
export function css(strings, ...args) {
  return new UnsafeHTML(join(interleave(strings, args.map(helper))));
}

/**
 * @template T
 * @param {ReadableStream<T>} stream 
 * @returns {AsyncIterable<T>} 
 */
export async function* stream2AsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally { reader.releaseLock() }
}

/** 
 * @template T 
 * @param {AsyncIterable<T>} asyncIterable 
 * @returns {ReadableStream<T>} 
 */
export function asyncIterable2Stream(asyncIterable) {
  const { readable, writable } = new TransformStream();
  (async () => {
    const writer = writable.getWriter();
    try {
      for await (const x of asyncIterable) writer.write(x);
    } finally { writer.close() }
  })();
  return readable;
}

/**
 * @typedef {string|UnsafeHTML|HTML|(string|UnsafeHTML|HTML)[]|
 *   Promise<string|UnsafeHTML|HTML|(string|UnsafeHTML|HTML)[]>} Arg
 */

/**
 * @param {Arg} arg 
 * @param {TextEncoder} encoder 
 */
async function* aHelper(arg, encoder) {
  const x = await arg;
  if (Array.isArray(x)) for (const xi of x) yield* aHelper(xi, encoder);
  else if (x instanceof HTML) yield* x;
  else if (x instanceof UnsafeHTML) yield encoder.encode(x.value);
  else yield encoder.encode(sanitize(x));
}

export class HTML {
  /**
   * @param {TemplateStringsArray} strings 
   * @param {Arg[]} args 
   */
  constructor(strings, args) { 
    this.encoder = new TextEncoder();
    this.strings = strings;
    this.args = args;
  }

  async *[Symbol.asyncIterator]() {
    const stringsIt = this.strings[Symbol.iterator]()
    const argsIt = this.args[Symbol.iterator]()
    while (true) {
      const { done: stringDone, value: string } = stringsIt.next();
      if (stringDone) break;
      else yield this.encoder.encode(string);

      const { done: argDone, value: arg } = argsIt.next();
      if (argDone) break;
      else yield* aHelper(arg, this.encoder);
    }
  }
}

/**
 * @param {TemplateStringsArray} strings 
 * @param {...Arg} args 
 * @returns {HTML}
 */
export function html(strings, ...args) {
  return new HTML(strings, args);
}

export class HTMLResponse extends Response {
  /**
   * @param {HTML} body 
   * @param {ResponseInit} [init] 
   */
  constructor(body, init) {
    super(asyncIterable2Stream(body), init);
    this.headers.set('Content-Type', 'text/html;charset=UTF-8');
  }
}
