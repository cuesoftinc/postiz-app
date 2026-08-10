import { Request } from 'express';
import { CookieOptions } from 'express';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Session cookies are stamped for the production domain (Secure, SameSite
 *  None), which browsers refuse to store for the localhost dev UI. When the
 *  request's Origin is a local dev origin, fall back to a host-only Lax
 *  cookie: localhost ports share cookies, so the Next dev server (:6274)
 *  sees what the API container (:4007) sets, and logout deletions match.
 *  Browsers never send a localhost Origin from production pages, and a
 *  forged Origin only buys a narrower cookie than the caller already holds. */
export const authCookieOptions = (req?: Request): CookieOptions => {
  let origin = '';
  try {
    origin = new URL((req?.headers?.origin as string) || '').origin;
  } catch {
    /* no or invalid Origin header: use production attributes */
  }
  if (LOCAL_DEV_ORIGIN.test(origin)) {
    return { httpOnly: true, sameSite: 'lax', path: '/' };
  }
  return {
    domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    ...(!process.env.NOT_SECURED
      ? {
          secure: true,
          httpOnly: true,
          sameSite: 'none',
        }
      : {}),
  };
};
