export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  scheduleViewPath,
  withQueryString,
} from '@gitroom/frontend/components/launches/schedule.routes';

/** Legacy URL. The Publish experience lives at the native Buffer-shaped
 *  /schedule URLs now; this preserves EVERY query param on the way over
 *  (state/tags/integration/customer/newPost/manageChannels, the OAuth legs'
 *  added/msg/continue/precondition, onboarding, ...). `display` moves into
 *  the path: list → /schedule/list, week → /schedule/calendar/week,
 *  day → /schedule/calendar/day, month/absent → /schedule/calendar/month. */
export default async function Index({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const display = Array.isArray(params.display)
    ? params.display[0]
    : params.display;
  redirect(withQueryString(scheduleViewPath(display), params));
}
