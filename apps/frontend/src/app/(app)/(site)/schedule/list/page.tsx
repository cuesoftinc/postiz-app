import { redirect } from 'next/navigation';

// Buffer-lingo alias: /schedule/list → list view
export default function ScheduleList() {
  redirect('/launches?display=list');
}
