import striptags from 'striptags';
import { parseFragment, serialize } from 'parse5';
import { htmlEntityDecoder } from '@gitroom/helpers/utils/decode.html.entities';

/**
 * The entities decoded once the tags are already gone. None of them can
 * produce a `<` or a `>`, so none of them can put markup into a string that
 * nothing is going to strip again.
 *
 * `lt` and `gt` are deliberately absent. This runs AFTER striptags, which is
 * the ordering trap this codebase has been bitten by twice: decoding them here
 * would turn `&lt;script&gt;` - the correct, escaped rendering of text a user
 * typed - into a real `<script>` tag in the output, past the only look the tag
 * stripper gets. The price is that a literal angle bracket reads as `&lt;` in
 * the text part; it is rare (values reach here through escapeHtml, and `<` in
 * a subject or an org name is unusual) and it is the safe direction to be
 * wrong in. `amp` is safe by the same test: `&` starts an entity but this
 * decoder makes ONE left-to-right pass, so `&amp;lt;` becomes the literal
 * `&lt;` the author typed and is never revisited.
 */
const decodeTextEntities = htmlEntityDecoder([
  'amp',
  'nbsp',
  'quot',
  'apos',
  '#39',
]);

const COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Script and style elements have to go WITH their contents. striptags removes
 * only the tags, which would drop the CSS of a styled email into the middle of
 * the plain text body as readable text.
 */
const SCRIPT_OR_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Anchors are the reason this cannot just be a tag strip. Every account email
 * we send is a link with a word wrapped around it (`Click <a href="...">here
 * </a> to activate your account`), so dropping the tag drops the entire point
 * of the message: a text-only client would show "Click here to activate your
 * account" with no way to do it.
 *
 * The pattern only has to handle double quoted attributes because it runs on
 * parse5 serializer output, which always emits them.
 */
const ANCHOR = /<a\b[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi;

/**
 * Tags that end a line of text. Both the opening and the closing form count,
 * because either can sit between two pieces of text: `<br>` has no closing
 * form, and `intro<div>heading</div>` would otherwise read as "introheading".
 * Table cells are in the list for the same reason - a cell boundary that
 * produced nothing would run "John" and "Doe" together into one word.
 */
const BLOCK_BOUNDARY =
  /<\/?(?:address|article|blockquote|br|caption|dd|div|dl|dt|footer|h[1-6]|header|hr|li|ol|p|pre|section|table|td|th|tr|ul)\b[^>]*>/gi;

/**
 * HTML has no significant whitespace, so a template indented for reading turns
 * into a text body of blank lines and deep leading indentation. Collapse it the
 * way a renderer would: runs of spaces and tabs become one space, and no more
 * than one blank line survives between blocks.
 */
const collapseWhitespace = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Renders an HTML email body as the plain text alternative to send beside it.
 *
 * The output is TEXT. It is not escaped and must never be interpolated back
 * into an HTML document.
 *
 * Order is: normalize, then strip, then decode. Normalizing through parse5
 * first is what makes the strip trustworthy - striptags is a scanner, so on
 * `I <3 you` it eats everything up to the next `>` and loses the sentence,
 * while the parser reads that as text and serializes it back as `&lt;3`.
 * Decoding is last, and is limited to the entities that cannot spell a tag;
 * see decodeTextEntities above for why that limit is the whole point.
 */
export const htmlToPlainText = (html: string): string => {
  if (!html) {
    return '';
  }

  const normalized = serialize(parseFragment(html))
    .replace(COMMENT, '')
    .replace(SCRIPT_OR_STYLE, '');

  const linked = normalized.replace(
    ANCHOR,
    (match, href: string, label: string) => {
      // A URI cannot contain a raw `<` or `>` (RFC 3986 requires them percent
      // encoded), and this text is about to be walked by the tag stripper, so
      // an href carrying one would open a tag that swallows the rest of the
      // email. Drop them rather than trust the caller.
      const url = href.replace(/[<>]/g, '').trim();
      const text = striptags(label).trim();

      if (!url) {
        return text;
      }

      // `<a href="https://x">https://x</a>` should read as one URL, not as the
      // same URL twice. Both sides are still entity encoded at this point, so
      // they are compared in the same form.
      if (!text || text === url) {
        return url;
      }

      return `${text} (${url})`;
    }
  );

  return collapseWhitespace(
    decodeTextEntities(striptags(linked.replace(BLOCK_BOUNDARY, '\n')))
  );
};
