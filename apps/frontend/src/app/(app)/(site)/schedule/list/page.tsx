export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@gitroom/frontend/components/launches/launches.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Cuesoft - Publish' : 'Gitroom Launches'}`,
  description: '',
};

/** Native Buffer-shaped list view. Renders the Publish experience directly —
 *  the calendar context reads display='list' from the pathname
 *  (schedule.routes.ts); dates/filters stay in the query. */
export default async function ScheduleList() {
  return <LaunchesComponent />;
}
