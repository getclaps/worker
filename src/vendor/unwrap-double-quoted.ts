const RE_QUOTED = /^(?:\"(([^"\\]|\\.)*)\"|(([^"\\]|\\.)*))$/;

/**
 * Unwraps a double quoted (`"`) string if and only if the quotes match while respecting escaped quotes (`\"`).
 * 
 * ```ts
 *  'foobar'  => 'foobar'
 * '"foobar"' => 'foobar'
 * '"foobar'  => undefined // missing close quote
 *  'foobar"' => undefined // missing open quote
 * ```
 * Treatment of escape character:
 * ```
 * '"foo said \\"bar\\""' => 'foo said "bar"'   // removes escape chars
 *  'foo said \\"bar\\"'  => 'foo said \"bar\"' // leaves escapes chars b/c not wrapped in quotes
 *  'foo said \\bar'      => 'foo said \bar'    // backslash has no effect unless as escape char
 * ```
 */
export const unwrapQuoted = (s: string) => {
  const match = s?.match(RE_QUOTED);
  return match && (match[1]?.replace(/\\\"/g, '"') ?? match[3]);
}
