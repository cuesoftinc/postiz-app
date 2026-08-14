/**
 * Decodes HTML entity references in ONE left-to-right pass.
 *
 * The pattern this replaces everywhere in the codebase was a chain of
 * `.replace()` calls:
 *
 *   text.replace(/&amp;/g, '&').replace(/&lt;/g, '<')
 *
 * Each call reads the output of the one before it, so `&amp;lt;` - which is
 * exactly what serialization produces when somebody literally types `&lt;` -
 * becomes `&lt;` on the first call and then `<` on the second. That is a
 * double unescape: text turns back into markup AFTER the tag stripper has had
 * its only look at the string. One pass never revisits what it just wrote, so
 * `&amp;lt;` decodes to the `&lt;` the author typed and stops there.
 *
 * Build a decoder once at module scope and reuse it; the regular expression
 * is compiled per decoder, not per call.
 */
const HTML_ENTITY_VALUES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  quot: '"',
  apos: "'",
  quest: '?',
  num: '#',
  '#39': "'",
};

export type HtmlEntityName = keyof typeof HTML_ENTITY_VALUES;

export const htmlEntityDecoder = (names: readonly string[]) => {
  const unknown = names.filter((name) => !(name in HTML_ENTITY_VALUES));
  if (unknown.length) {
    throw new Error(`Unknown HTML entities: ${unknown.join(', ')}`);
  }

  // Every name here is a fixed literal made of letters, digits and '#', so
  // none of them needs regex escaping and the alternation cannot backtrack.
  const pattern = new RegExp(`&(${names.join('|')});`, 'gi');

  return (value: string): string =>
    value.replace(
      pattern,
      (match, name: string) => HTML_ENTITY_VALUES[name.toLowerCase()] ?? match
    );
};
