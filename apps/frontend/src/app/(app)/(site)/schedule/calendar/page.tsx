import { redirect } from 'next/navigation';

// Buffer-lingo alias: bare /schedule/calendar → week view (Buffer's default)
export default function ScheduleCalendar() {
  redirect('/launches?display=week');
}
