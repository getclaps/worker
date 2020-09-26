/**
 * @template X
 * @template Y
 * @param {Iterable<X>} xs 
 * @param {Iterable<Y>} ys 
 * @returns {IterableIterator<X | Y>}
 */
export function* interleave(xs, ys) {
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

/**
 * @template X
 * @template Y
 * @param {Iterable<X>} xs 
 * @param {Iterable<AsyncIterable<Y>>} ys 
 * @returns {AsyncIterableIterator<X | Y>}
 */
export async function* aInterleaveFlattenSecond(xs, ys) {
  const itx = xs[Symbol.iterator]();
  const ity = ys[Symbol.iterator]();
  while (true) {
    const rx = itx.next();
    if (rx.done) break;
    else yield rx.value;
    const ry = ity.next();
    if (ry.done) break;
    else yield* ry.value;
  }
}

/**
 * @template A
 * @template B
 * @param {(a: A) => B} f 
 */
export function map(f) {
  return /** @param {Iterable<A>} iterable @returns {IterableIterator<B>} */ function*(iterable) { 
    for (const x of iterable) yield f(x);
  };
}

/**
 * @template A
 * @template B
 * @param {(a: A) => B|Promise<B>} f 
 */
export function aMap(f) {
  return /** @param {Iterable<A>|AsyncIterable<A>} forAwaitable @returns {AsyncIterableIterator<B>} */ async function*(forAwaitable) { 
    for await (const x of forAwaitable) yield f(x);
  };
}

/** @param {Iterable<String>} xs */
export const join = (xs) => [...xs].join('');
