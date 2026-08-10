export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';

// The content chat merged into the agent page ([Assistant | Content]
// segmented). Old /content links land on the Content segment. The target is
// /agents/new (not /agents): /agents itself hard-redirects to '/agents/new'
// and would drop the ?mode param on the way.
export default async function Index() {
  return redirect('/agents/new?mode=content');
}
