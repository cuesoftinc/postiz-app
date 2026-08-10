export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@gitroom/frontend/components/launches/launches.component';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { withQueryString } from '@gitroom/frontend/components/launches/schedule.routes';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Cuesoft - Publish' : 'Gitroom Launches'}`,
  description: '',
};

/** Native Buffer-shaped calendar views: /schedule/calendar/month|week|day
 *  render the Publish experience directly — the calendar context reads the
 *  display from the pathname (schedule.routes.ts). Buffer's three-day maps
 *  to our week; anything unknown falls back to month. */
export default async function ScheduleCalendarView({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view } = await params;
  if (view === 'month' || view === 'week' || view === 'day') {
    return <LaunchesComponent />;
  }
  redirect(
    withQueryString(
      `/schedule/calendar/${view === 'three-day' ? 'week' : 'month'}`,
      await searchParams
    )
  );
}
