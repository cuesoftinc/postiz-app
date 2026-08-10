import { redirect } from 'next/navigation';

// Buffer-lingo alias: publish.buffer.com/schedule → our launches page
export default function Schedule() {
  redirect('/launches');
}
