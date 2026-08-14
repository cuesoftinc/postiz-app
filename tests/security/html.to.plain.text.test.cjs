const assert = require('node:assert/strict');
const test = require('node:test');
const {
  htmlToPlainText,
} = require('@gitroom/helpers/utils/html.to.plain.text');

// This helper produces the text/plain alternative of every outgoing email, so
// its output is read by humans, not rendered. Two things must hold and neither
// is obvious from the code:
//
// 1. No markup survives. CodeQL flags the tag strip as "incomplete
//    sanitization" because it is a single pass, which is the correct heuristic
//    for a bare regex. It is wrong here only because the strip runs on the
//    output of parse5, so `<script` appearing in TEXT is already normalized to
//    `&lt;script` before the strip sees it. That reasoning is the whole
//    argument for dismissing the alert, so it is pinned here rather than left
//    in a comment.
//
// 2. Entities decode exactly once. Decoding after the strip is what turned
//    `&lt;script&gt;` back into real markup elsewhere in this codebase on
//    2026-08-14; the ordering fix is only safe while lt/gt stay undecoded.

const HOSTILE = [
  '<script>alert(1)</script>',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '&amp;lt;script&amp;gt;',
  '<scr<a>ipt>alert(1)</scr<b>ipt>',
  '<img src=x onerror=alert(1)>',
  '<div title=">">hi</div>',
  '<!-- <script>alert(1)</script> -->',
  '<style>body{}</style><script>alert(1)</script>',
  '<textarea><script>alert(1)</script></textarea>',
  '<SCRIPT>alert(1)</SCRIPT>',
  '<<script>script>alert(1)<</script>/script>',
  'I <3 you',
  '<p>a</p><p>b</p>',
];

test('no markup survives into the plain-text alternative', () => {
  for (const input of HOSTILE) {
    const out = htmlToPlainText(input);
    assert.ok(
      !/<[a-z/!]/i.test(out),
      `markup survived for ${JSON.stringify(input)}: ${JSON.stringify(out)}`
    );
    assert.ok(
      !/<script/i.test(out),
      `<script survived for ${JSON.stringify(input)}: ${JSON.stringify(out)}`
    );
  }
});

test('entities decode exactly once, never into markup', () => {
  // The double-unescape that was fixed elsewhere today: one pass must leave the
  // literal, not a tag.
  assert.equal(htmlToPlainText('&amp;lt;script&amp;gt;'), '&lt;script&gt;');
  // An ampersand in an ordinary name must read as an ampersand, which is the
  // defect that started this: "Smith &amp; Co" was reaching text-only clients.
  assert.equal(htmlToPlainText('<p>Smith &amp; Co</p>'), 'Smith & Co');
});

test('a bare < is text, not the start of a tag', () => {
  // striptags alone eats to the next '>' and loses the sentence; parsing first
  // is what makes the strip trustworthy.
  assert.match(htmlToPlainText('I <3 you'), /I <3 you|I &lt;3 you/);
});

test('links keep their destination, since the reader cannot click markup', () => {
  const out = htmlToPlainText('<a href="https://example.com/x">Accept</a>');
  assert.ok(out.includes('https://example.com/x'), `lost the href: ${out}`);
});
