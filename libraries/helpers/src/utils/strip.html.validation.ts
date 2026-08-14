import striptags from 'striptags';
import { parseFragment, serialize } from 'parse5';
import { htmlEntityDecoder } from '@gitroom/helpers/utils/decode.html.entities';

/** Every entity this file understands, decoded in a single pass. */
const decodeAllEntities = htmlEntityDecoder([
  'amp',
  'lt',
  'gt',
  'nbsp',
  'quot',
  '#39',
]);

/**
 * The entities that are safe to decode BEFORE striptags runs: none of them
 * produces a `&`, a `<` or a `>`, so decoding them can neither feed a later
 * decode nor conjure a tag that the stripper has already walked past.
 */
const decodeTextEntities = htmlEntityDecoder(['nbsp', 'quot', '#39']);

/**
 * The entities that must wait until AFTER striptags. `&lt;`/`&gt;` decode to
 * markup characters, and `&amp;` decodes to the `&` that starts every other
 * entity, so both have to happen once, last, in the same pass.
 */
const decodeMarkupEntities = htmlEntityDecoder(['amp', 'lt', 'gt']);

const bold = {
  a: '𝗮',
  b: '𝗯',
  c: '𝗰',
  d: '𝗱',
  e: '𝗲',
  f: '𝗳',
  g: '𝗴',
  h: '𝗵',
  i: '𝗶',
  j: '𝗷',
  k: '𝗸',
  l: '𝗹',
  m: '𝗺',
  n: '𝗻',
  o: '𝗼',
  p: '𝗽',
  q: '𝗾',
  r: '𝗿',
  s: '𝘀',
  t: '𝘁',
  u: '𝘂',
  v: '𝘃',
  w: '𝘄',
  x: '𝘅',
  y: '𝘆',
  z: '𝘇',
  A: '𝗔',
  B: '𝗕',
  C: '𝗖',
  D: '𝗗',
  E: '𝗘',
  F: '𝗙',
  G: '𝗚',
  H: '𝗛',
  I: '𝗜',
  J: '𝗝',
  K: '𝗞',
  L: '𝗟',
  M: '𝗠',
  N: '𝗡',
  O: '𝗢',
  P: '𝗣',
  Q: '𝗤',
  R: '𝗥',
  S: '𝗦',
  T: '𝗧',
  U: '𝗨',
  V: '𝗩',
  W: '𝗪',
  X: '𝗫',
  Y: '𝗬',
  Z: '𝗭',
  '1': '𝟭',
  '2': '𝟮',
  '3': '𝟯',
  '4': '𝟰',
  '5': '𝟱',
  '6': '𝟲',
  '7': '𝟳',
  '8': '𝟴',
  '9': '𝟵',
  '0': '𝟬',
};

const underlineMap = {
  a: 'a̲',
  b: 'b̲',
  c: 'c̲',
  d: 'd̲',
  e: 'e̲',
  f: 'f̲',
  g: 'g̲',
  h: 'h̲',
  i: 'i̲',
  j: 'j̲',
  k: 'k̲',
  l: 'l̲',
  m: 'm̲',
  n: 'n̲',
  o: 'o̲',
  p: 'p̲',
  q: 'q̲',
  r: 'r̲',
  s: 's̲',
  t: 't̲',
  u: 'u̲',
  v: 'v̲',
  w: 'w̲',
  x: 'x̲',
  y: 'y̲',
  z: 'z̲',
  A: 'A̲',
  B: 'B̲',
  C: 'C̲',
  D: 'D̲',
  E: 'E̲',
  F: 'F̲',
  G: 'G̲',
  H: 'H̲',
  I: 'I̲',
  J: 'J̲',
  K: 'K̲',
  L: 'L̲',
  M: 'M̲',
  N: 'N̲',
  O: 'O̲',
  P: 'P̲',
  Q: 'Q̲',
  R: 'R̲',
  S: 'S̲',
  T: 'T̲',
  U: 'U̲',
  V: 'V̲',
  W: 'W̲',
  X: 'X̲',
  Y: 'Y̲',
  Z: 'Z̲',
  '1': '1̲',
  '2': '2̲',
  '3': '3̲',
  '4': '4̲',
  '5': '5̲',
  '6': '6̲',
  '7': '7̲',
  '8': '8̲',
  '9': '9̲',
  '0': '0̲',
};

export const stripHtmlValidation = (
  type: 'none' | 'normal' | 'markdown' | 'html',
  val: string,
  replaceBold = false,
  none = false,
  plain = false,
  convertMentionFunction?: (idOrHandle: string, name: string) => string
): string => {
  if (plain) {
    return val;
  }

  const value = serialize(parseFragment(val));

  if (type === 'none') {
    return decodeAllEntities(striptags(value));
  }

  if (type === 'html') {
    return decodeAllEntities(
      striptags(convertMention(value, convertMentionFunction), [
        'ul',
        'li',
        'h1',
        'h2',
        'h3',
        'p',
        'strong',
        'u',
        'a',
      ])
    );
  }

  if (type === 'markdown') {
    return decodeMarkupEntities(
      striptags(
        convertMention(
          decodeTextEntities(
            value.replace(/<h1>([.\s\S]*?)<\/h1>/g, (match, p1) => {
              return `<h1># ${p1}</h1>\n`;
            })
          )
            .replace(/<h2>([.\s\S]*?)<\/h2>/g, (match, p1) => {
              return `<h2>## ${p1}</h2>\n`;
            })
            .replace(/<h3>([.\s\S]*?)<\/h3>/g, (match, p1) => {
              return `<h3>### ${p1}</h3>\n`;
            })
            .replace(/<u>([.\s\S]*?)<\/u>/g, (match, p1) => {
              return `<u>__${p1}__</u>`;
            })
            .replace(/<strong>([.\s\S]*?)<\/strong>/g, (match, p1) => {
              return `<strong>**${p1}**</strong>`;
            })
            .replace(/<li.*?>([.\s\S]*?)<\/li.*?>/gm, (match, p1) => {
              return `<li>- ${p1.replace(/\n/gm, '')}</li>`;
            })
            .replace(/<p>([.\s\S]*?)<\/p>/g, (match, p1) => {
              return `<p>${p1}</p>\n`;
            })
            .replace(
              /<a.*?href="([.\s\S]*?)".*?>([.\s\S]*?)<\/a>/g,
              (match, p1, p2) => {
                return `<a href="${p1}">[${p2}](${p1})</a>`;
              }
            ),
          convertMentionFunction
        )
      )
    );
  }

  if (value.indexOf('<p>') === -1 && !none) {
    return value;
  }

  const html = decodeTextEntities(value || '')
    .replace(/^<p[^>]*>/i, '')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '');

  if (none) {
    return decodeMarkupEntities(striptags(html));
  }

  if (replaceBold) {
    const processedHtml = convertMention(
      convertToAscii(
        html
          .replace(
            /<a.*?href="([.\s\S]*?)".*?>([.\s\S]*?)<\/a>/g,
            (match, p1, p2) => {
              return `<a href="${p1}">${p1}</a>`;
            }
          )
          .replace(/<ul>/, '\n<ul>')
          .replace(/<\/ul>\n/, '</ul>')
          .replace(/<li.*?>([.\s\S]*?)<\/li.*?>/gm, (match, p1) => {
            return `<li><p>- ${p1.replace(/\n/gm, '')}\n</p></li>`;
          })
      ),
      convertMentionFunction
    );

    // There used to be four more replaces here turning `&𝗹𝘁;` and friends
    // back into `<` and `>`. They existed only because convertToAscii bolded
    // the letters inside an entity reference; it now steps over the whole
    // reference, so `&lt;` reaches the decode above intact. They are gone
    // rather than left inert because each was a SECOND decode of the same
    // string: `&amp;lt;` (an author typing the literal text `&lt;`) decoded
    // to `&lt;` and then to a real `<`, which is the double unescape this
    // whole file was flagged for. convertToAscii is not exported anywhere
    // else, so nothing can still be carrying the bolded forms.
    return decodeMarkupEntities(striptags(processedHtml));
  }

  // Strip all other tags
  return decodeMarkupEntities(striptags(html, ['ul', 'li', 'h1', 'h2', 'h3']));
};

export const convertMention = (
  value: string,
  process?: (idOrHandle: string, name: string) => string
) => {
  if (!process) {
    return value;
  }

  return value.replace(
    /<span.*?data-mention-id="([.\s\S]*?)"[.\s\S]*?>([.\s\S]*?)<\/span>/gi,
    (match, id, name) => {
      return `<span>` + process(id, name) + `</span>`;
    }
  );
};

/**
 * One entity reference, or one single character. Splitting on characters
 * alone turned `&amp;` into `&𝗮𝗺𝗽;`, which no decoder can read back, so an
 * ampersand inside bold or underlined text was lost. Matching the whole
 * reference first steps over it untouched and leaves it for the entity decode
 * that runs after striptags.
 */
const ENTITY_OR_CHARACTER =
  /&(?:[a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#[xX][0-9a-fA-F]+);|[\s\S]/g;

const mapCharacters = (text: string, map: Record<string, string>): string =>
  text.replace(ENTITY_OR_CHARACTER, (token) =>
    token.length === 1 ? map[token] || token : token
  );

export const convertToAscii = (value: string): string => {
  return value
    .replace(/<strong>(.+?)<\/strong>/gi, (match, p1) => {
      // A function replacement, so a `$&` in the text is not read as a
      // replacement pattern.
      return match.replace(p1, () => mapCharacters(p1, bold));
    })
    .replace(/<u>(.+?)<\/u>/gi, (match, p1) => {
      return match.replace(p1, () => mapCharacters(p1, underlineMap));
    });
};
