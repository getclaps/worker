import { Awaitable } from "./common-types";

type Stringable = { toString(): string };

/**
 * Before:
 * ```
 * `My ${await comp1()} convoluted ${await comp2()} string.`;
 * ```
 * After: 
 * ```
 * await astr`My ${comp1()} cleaned-up ${comp2()} string.`;
 * ```
 */
export async function asyncString(strings: TemplateStringsArray, ...args: Awaitable<string | Stringable>[]) {
  const res: string[] = [];
  for (const x of interleave(strings, args)) res.push((await x).toString())
  return res.join('');
}

export { asyncString as astr };

/**
 * Alternates items from the first and second iterable in the output iterable, until either input runs out of items.
 */
export function* interleave<X, Y>(xs: Iterable<X>, ys: Iterable<Y>): IterableIterator<X | Y> {
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