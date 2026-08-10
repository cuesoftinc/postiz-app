export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { withQueryString } from '@gitroom/frontend/components/launches/schedule.routes';

/** Bare /schedule/calendar → week, Buffer's calendar default
 *  (publish.buffer.com/calendar lands on /calendar/week). */
export default async function ScheduleCalendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(withQueryString('/schedule/calendar/week', await searchParams));
}
