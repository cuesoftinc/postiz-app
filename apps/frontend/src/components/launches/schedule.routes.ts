/** Native Buffer-shaped Publish URLs.
 *
 *  The view lives in the PATH — /schedule/list, /schedule/calendar/month,
 *  /schedule/calendar/week (and the URL-reachable /schedule/calendar/day) —
 *  while dates and filters stay in the query (startDate/endDate ≈ Buffer's
 *  ?date= handling, plus integration/customer/state/tags). `?display=` is
 *  kept only as a legacy deep-link override.
 *
 *  Single source of truth for:
 *  - the /launches → /schedule redirect (app/(app)/(site)/launches/page.tsx)
 *  - the /schedule cookie-preferred hop (app/(app)/(site)/schedule/page.tsx)
 *  - the calendar context's history.replaceState URL writer
 */

/** display value → the native path that encodes it. */
export function scheduleViewPath(display?: string | null): string {
  switch (display) {
    case 'list':
      return '/schedule/list';
    case 'week':
      return '/schedule/calendar/week';
    case 'day':
      return '/schedule/calendar/day';
    default:
      // Buffer (and our cookie) default to the month calendar
      return '/schedule/calendar/month';
  }
}

/** The display a native /schedule pathname encodes, if any. */
export function displayFromPathname(pathname: string | null): string | null {
  if (!pathname) {
    return null;
  }
  if (pathname === '/schedule/list') {
    return 'list';
  }
  const match = pathname.match(/^\/schedule\/calendar\/(month|week|day)$/);
  return match ? match[1] : null;
}

/** Rebuilds a redirect target keeping EVERY incoming query param — newPost,
 *  manageChannels, integration, customer, state, tags, startDate/endDate,
 *  the OAuth legs' added/msg/onboarding, ... `display` is dropped by default
 *  because the native path already encodes it. */
export function withQueryString(
  path: string,
  params: Record<string, string | string[] | undefined>,
  drop: string[] = ['display']
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (drop.includes(key)) {
      continue;
    }
    const values = Array.isArray(value) ? value : value != null ? [value] : [];
    for (const entry of values) {
      search.append(key, entry);
    }
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}
