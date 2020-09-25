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

export class HTML {
  /** @param {string} value */
  constructor(value) { this.value = value }
  toString() { return this.value }
  toJSON() { return this.value }
}

/** @param {string} safeHTML */
export function unsafeHTML(safeHTML) {
  return new HTML(safeHTML)
}

/** @param {any} x @return {string} */
function helper(x) {
  if (!x) return '';
  if (Array.isArray(x)) return x.map(helper).join('');
  if (x instanceof HTML) return x.value;
  return sanitize(x);
}

/**
 * @param {TemplateStringsArray} strings 
 * @param {...any} args 
 */
export function css(strings, ...args) {
  return new HTML(join(interleave(strings, args.map(helper))));
}

/**
 * @template T
 * @param {ReadableStream<T>} stream 
 * @returns {AsyncIterable<T>} 
 */
async function* stream2AsyncIterator(stream) {
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
function asyncIterator2Stream(asyncIterable) {
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
 * @param {string|HTML|ReadableStream<Uint8Array>|(string|ReadableStream<Uint8Array>)[]|
 * Promise<string|HTML|ReadableStream<Uint8Array>|(string|ReadableStream<Uint8Array>)[]>} arg 
 * @param {TextEncoder} te 
 */
async function* aHelper(arg, te) {
  const x = await arg;
  if (!x) yield new Uint8Array([]);
  else if (Array.isArray(x)) for (const xx of x) yield* aHelper(xx, te);
  else if (x instanceof ReadableStream) yield* stream2AsyncIterator(x);
  else if (x instanceof HTML) yield te.encode(x.value);
  else yield te.encode(sanitize(x));
}

/**
 * @param {TemplateStringsArray} strings 
 * @param {...any} args 
 * @returns {ReadableStream<Uint8Array>}
 */
export function html(strings, ...args) {
  const te = new TextEncoder();
  return asyncIterator2Stream(async function* () {
    const stringsIt = strings[Symbol.iterator]()
    const argsIt = args[Symbol.iterator]()
    while (true) {
      const { done: stringDone, value: string } = stringsIt.next();
      if (stringDone) break;
      else yield te.encode(string);

      const { done: argDone, value: arg } = argsIt.next();
      if (argDone) break;
      else yield* aHelper(arg, te);
    }
  }());
}

// export { html as css };
