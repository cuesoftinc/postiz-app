export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { WeekRun } from '@gitroom/frontend/components/content-agent/week-run.component';

export const metadata: Metadata = {
  title: 'Cuesoft - Week run',
  description: '',
};

/**
 * /content is THE WEEK RUN — the reviewable object a weekly agent run leaves
 * behind (exports/week-<N>/run.json, served by the content bridge and joined
 * against Postiz here). `?week=<n>` opens a specific week; with no week it opens
 * the most recent run there is.
 *
 * THIS ROUTE USED TO REDIRECT TO THE CHAT, and the swap is deliberate. The
 * objection this surface was built against is that a report you have to remember
 * to open does not survive contact with a real week, so the run needs an address
 * somebody can actually reach. The chat did not need this one: it has a
 * top-level nav entry of its own ("Ace"), so it is one click away from anywhere,
 * while the run had no route, no link and no nav entry at all. `?chat=1` keeps
 * the old behaviour for anything still pointing here, and the page itself links
 * back to the chat.
 *
 * STILL OWED (nobody's follow-up but the next person to touch the shell): a nav
 * entry, so the week is reachable without knowing the URL exists.
 */
export default async function Index(params: {
  searchParams: Promise<{ week?: string; chat?: string }>;
}) {
  const search = await params?.searchParams;
  if (search?.chat) {
    // The target is /agents/new, not /agents: /agents hard-redirects to
    // '/agents/new' and would drop the ?mode param on the way.
    return redirect('/agents/new?mode=content');
  }
  // Parsed here rather than in the client so a nonsense ?week= never becomes a
  // request; the component treats null as "open the newest run".
  const n = Number(search?.week);
  const week = Number.isInteger(n) && n >= 1 && n <= 53 ? n : null;
  return <WeekRun initialWeek={week} />;
}
