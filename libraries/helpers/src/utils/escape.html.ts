const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Makes a value safe to interpolate into an HTML document or an HTML email
 * body.
 *
 * `&` is escaped in the same pass as everything else, so an input that already
 * reads `&lt;` survives as the literal text `&lt;` rather than turning back
 * into a tag when something downstream decodes entities.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character]
  );
