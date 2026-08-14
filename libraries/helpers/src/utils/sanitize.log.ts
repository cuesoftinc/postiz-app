/**
 * Makes a user-supplied value safe to interpolate into a log line.
 *
 * Anything that reaches a log from a request body, a query string or a remote
 * server can carry newlines, carriage returns and terminal control sequences.
 * Left alone they let an attacker forge whole log entries (log injection) or
 * garble a terminal that tails the output. Control characters become spaces,
 * so the value stays visible instead of silently disappearing, and the result
 * is capped so one field cannot flood the log.
 */
const CONTROL_CHARACTER_CEILING = 0x20;
const DELETE_CHARACTER = 0x7f;

export const sanitizeForLog = (value: unknown, maxLength = 500): string => {
  const asString =
    typeof value === 'string'
      ? value
      : value === undefined
      ? ''
      : (() => {
          try {
            return JSON.stringify(value) ?? String(value);
          } catch {
            return String(value);
          }
        })();

  // The two explicit replaces are the ones that matter for log forging; the
  // map then flattens every other control character (escape sequences, NUL).
  const cleaned = Array.from(asString.replace(/\n/g, ' ').replace(/\r/g, ' '))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < CONTROL_CHARACTER_CEILING || code === DELETE_CHARACTER
        ? ' '
        : character;
    })
    .join('');

  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}...[truncated]`
    : cleaned;
};
