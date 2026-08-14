import { readFileSync } from 'fs';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

/**
 * Reads media that may be either a local path or a remote URL.
 *
 * The remote branch used to be a bare axios GET. Every caller feeds it a media
 * path that originates in a request body (post media, `FRONTEND_URL` joined to
 * a stored path), so that request has to carry the same SSRF guard as the rest
 * of the outbound traffic in this codebase: the pinned dispatcher re-checks
 * every resolved IP, on the first request and on each redirect hop, which is
 * what stops a public host from bouncing the read onto a private address.
 *
 * axios cannot take an undici dispatcher, so the remote branch is fetch. The
 * return type is unchanged: axios with `responseType: 'arraybuffer'` yields a
 * Buffer on Node, and so does this.
 */
export const readOrFetch = async (path: string): Promise<Buffer> => {
  if (path.indexOf('http') === 0) {
    const response = await fetch(path, {
      // @ts-ignore - undici-only option, not in the lib.dom RequestInit type
      dispatcher: getSsrfSafeDispatcher(),
    });

    // axios rejected on a non-2xx; keep that so callers do not hand an HTML
    // error page to sharp and fail with something unrelated.
    if (!response.ok) {
      throw new Error(
        `Failed to fetch media (HTTP ${response.status}) while reading ${
          new URL(path).origin
        }`
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  return readFileSync(path);
};
