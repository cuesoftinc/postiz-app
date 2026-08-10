import { redirect } from 'next/navigation';

// Buffer-lingo aliases: /schedule/calendar/month|week|day|three-day
const VIEWS: Record<string, string> = {
  month: 'month',
  week: 'week',
  day: 'day',
  'three-day': 'week',
};

export default async function ScheduleCalendar({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  redirect(`/launches?display=${VIEWS[view] || 'week'}`);
}
