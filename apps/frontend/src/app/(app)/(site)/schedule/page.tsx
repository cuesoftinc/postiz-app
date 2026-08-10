export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  scheduleViewPath,
  withQueryString,
} from '@gitroom/frontend/components/launches/schedule.routes';

/** Publish home. Like Buffer's publish.buffer.com, bare /schedule lands on
 *  the cookie-preferred view (`calendar-display`, month by default) — the
 *  sidebar/nav deep links (?newPost=1, ?manageChannels=1, ?integration=...)
 *  ride the redirect untouched. */
export default async function Schedule({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const saved = (await cookies()).get('calendar-display')?.value;
  redirect(withQueryString(scheduleViewPath(saved), params));
}
