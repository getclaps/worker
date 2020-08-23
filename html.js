import sanetize from 'sanitize-html';

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

/** @param {any} x * @return {string} */
function helper(x) {
  if (!x) return '';
  if (Array.isArray(x)) return x.map(helper).join('');
  if (x instanceof HTML) return x.value;
  return sanetize(x);
}

/**
 * @param {TemplateStringsArray} strings 
 * @param {...any} args 
 */
export function html(strings, ...args) {
  return new HTML(join(interleave(strings, args.map(helper))))
}

export { html as css };
