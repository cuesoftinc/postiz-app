'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import { Button } from '@gitroom/react/form/button';
import { areYouSure } from '@gitroom/frontend/components/layout/new-modal';

/**
 * THE WEEK RUN — a weekly agent run rendered as a reviewable object.
 *
 * A run used to be reviewable only by scrolling the chat it happened in, which
 * meant approving a week on the strength of Ace's own summary of it. This page
 * shows the same week as a record, and it is built around one distinction that
 * the whole feature rests on:
 *
 *   CHECKED — the post set, the datetimes, the handoffs, the edited-since-run
 *             flags and the live Postiz state. All of it is computed from files
 *             and from the database by code Ace does not write, and all of it is
 *             re-verified when this page loads.
 *   ACE'S OWN ACCOUNT — the rationale, the sources, the confidence and the list
 *             of things it could not verify. Prose. Unfalsifiable from here.
 *
 * The two are rendered as visibly different kinds of thing, in that order, and
 * the second is labelled as the agent's own account wherever it appears. The
 * reason is the objection the feature was built against: reading Ace's
 * explanation of Thursday can make approving Thursday FEEL better informed while
 * adding no independent information. Keeping the halves apart is what stops the
 * page from being a nicer-looking version of the transcript.
 *
 * Two rules worth keeping while editing:
 *  - NEVER present the week as complete when the join is broken. If any id in
 *    schedule.json is missing from the record, the header says so with a count
 *    and the summary chip goes red. A broken join is the exact failure this
 *    surface would otherwise hide, because a stale record still parses.
 *  - NEVER render a record that failed its schema. The bridge answers 422 with
 *    the violations and this page prints them instead of the week; half a record
 *    shown hopefully is worse than a refusal, since the reader cannot tell which
 *    half is missing.
 */

type RunPost = {
  id: string;
  platform: string;
  datetime: string | null;
  type: string;
  media: string[];
  resharesOf?: string;
  hasCaption: boolean;
  captionChars: number;
  hasAltText: boolean;
  hasFirstComment: boolean;
  needsCopy: boolean;
  inSchedule: boolean;
  scheduleDatetime: string | null;
  datetimeChanged: boolean;
  push: {
    status: string;
    attempts: number;
    postizId: string | null;
    pushedFor: string | null;
    drift: boolean;
    lastError: string | null;
  } | null;
  /** added by the backend proxy from the Postiz database; null = no postizId */
  postiz:
    | null
    | { lookedUp: false }
    | { lookedUp: true; found: false }
    | {
        lookedUp: true;
        found: true;
        state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT';
        needsApproval: boolean;
        publishDate: string | null;
        dateMatches: boolean | null;
        deleted: boolean;
        releaseURL: string | null;
      };
};

type WeekRunPayload = {
  week: number;
  schemaVersion: string;
  record: {
    generator: string;
    builtAt: string;
    weekMonday: string;
    campaignDate: string | null;
    timezone: string | null;
    counts: Record<string, any>;
    inputs: any;
  };
  posts: RunPost[];
  unmatched: { id: string; platform: string | null; datetime: string | null }[];
  stray: string[];
  /** THE THIRD WAY THE JOIN BREAKS, and the one neither list above can show: a
   *  post that WAS pushed to Postiz and was then dropped or renamed by a
   *  schedule rebuild. The rebuild rewrites the record and the schedule
   *  together, so those two agree with each other and the week reads as
   *  complete, while the push state still holds a live Postiz id that appears
   *  in no list on this page. The post outlives every record of it.
   *  `inSchedule` separates the two cases: true means the schedule still
   *  carries the id and `unmatched` names it too, from the other side; false
   *  means this row is its only mention anywhere.
   *  Optional because a bridge older than this field does not send it, and an
   *  absent field must render as nothing rather than as zero orphans confirmed. */
  orphanedPushes?: {
    id: string;
    status: string;
    postizId: string | null;
    pushedFor: string | null;
    inSchedule: boolean;
  }[];
  /** The weaker sibling of `orphanedPushes`: a row whose state entry does NOT
   *  prove a post was created. A `failed` row with no postizId may have been a
   *  pre-flight refusal (missing caption, past datetime) that never left the
   *  machine, or a create whose answer never arrived, and `lastError` is the
   *  only thing that tells a human which. Deliberately NOT part of `complete`:
   *  "this may have created nothing" is a different sentence from "this is live
   *  in Postiz", and conflating them is how a verification field starts crying
   *  wolf. */
  uncertainPushes?: {
    id: string;
    status: string;
    postizId: string | null;
    pushedFor: string | null;
    inSchedule: boolean;
    lastError: string | null;
  }[];
  handoffs: { id: string; platform: string | null; kind: string; detail: string }[];
  verification: {
    complete: boolean;
    scheduleReadable: boolean;
    scheduleProblem: string | null;
    unmatchedCount: number;
    strayCount: number;
    orphanedPushCount?: number;
    scheduleEdited: boolean | null;
    contentEdited: boolean | null;
    contentMissing: boolean;
    datetimeChangedCount: number;
    push: {
      present: boolean;
      recorded: number;
      byStatus: Record<string, number>;
      linked: number;
      unlinked: number;
      driftCount: number;
      /** the same number as `orphanedPushCount`, carried in the push block
       *  because that block is the push summary a reviewer reads */
      orphaned?: number;
      /** same number as `uncertainPushes.length` */
      uncertain?: number;
    };
  };
  account: {
    authoredAt: string;
    rationale: string;
    sources: { what: string; where: string }[];
    confidence: 'high' | 'medium' | 'low';
    unverified: string[];
  } | null;
  authored: boolean;
  /** the account file was written before this record was built, so it describes
      an earlier build of the week */
  accountStale: boolean;
  accountViolations: string[];
  postiz?: {
    gateOn: boolean;
    linked: number;
    lookedUp: number;
    notLookedUp: number;
    found: number;
    missing: number;
    awaitingApproval: number;
    draft: number;
    queued: number;
    published: number;
    errored: number;
    deleted: number;
    undated: number;
    dateMismatch: number;
  };
  error?: string;
  code?: string;
  violations?: string[];
};

type RunIndexEntry = {
  week: number;
  ok: boolean;
  weekMonday?: string;
  posts?: number;
  handoffs?: number;
  authored?: boolean;
  complete?: boolean;
  unmatchedCount?: number;
  orphanedPushCount?: number;
  violations?: number;
};

/** The record carries wall-clock strings with an offset (`+01:00`), which is the
 *  claim it is making about when the week goes out. Rendering them through the
 *  reader's local timezone would silently restate that claim as a different
 *  time, so the offset is kept and only the shape is prettified. */
const timeOf = (iso: string | null) => {
  if (!iso) return '—';
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : iso;
};
const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
const prettyDay = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
};
const weekRange = (monday: string) => {
  const d = new Date(`${monday}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return monday;
  const end = new Date(d.getTime() + 6 * 86400000);
  const f = (x: Date) =>
    x.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  return `${f(d)} – ${f(end)} ${end.getUTCFullYear()}`;
};

/** Status pill. `tone` is the only thing that carries alarm, and it is set from
 *  a computed verdict, never from anything the agent wrote. */
const Pill: FC<{
  tone: 'ok' | 'warn' | 'bad' | 'muted';
  children: React.ReactNode;
}> = ({ tone, children }) => (
  <span
    className={clsx(
      'inline-flex items-center h-[24px] px-[10px] rounded-[999px] text-[12px] font-[550] whitespace-nowrap',
      tone === 'ok' && 'bg-newTextColor/5 text-newTextColor/70',
      tone === 'warn' && 'bg-[#B191FF]/15 text-[#B191FF]',
      tone === 'bad' && 'bg-red-500/15 text-red-400',
      tone === 'muted' && 'bg-newTextColor/5 text-newTextColor/50'
    )}
  >
    {children}
  </span>
);

const Panel: FC<{
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, hint, right, children }) => (
  <section className="rounded-[12px] border border-newTableBorder bg-newBgColorInner">
    <div className="flex items-center gap-[10px] px-[16px] py-[12px] border-b border-newTableBorder">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-[600] text-newTextColor">{title}</div>
        {!!hint && (
          <div className="text-[12px] text-newTextColor/50 mt-[2px]">{hint}</div>
        )}
      </div>
      {right}
    </div>
    <div className="p-[16px]">{children}</div>
  </section>
);

/** One verification row: what was checked, and what it came back as. Rendered as
 *  a sentence rather than a tick, because "unchanged" and "could not be checked"
 *  are different answers and a tick collapses them. */
const Check: FC<{
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
  verdict: string;
  detail?: string;
}> = ({ label, tone, verdict, detail }) => (
  <div className="flex items-start gap-[10px] py-[8px] border-b border-newTableBorder last:border-b-0">
    <span
      className={clsx(
        'mt-[6px] w-[8px] h-[8px] rounded-full shrink-0',
        tone === 'ok' && 'bg-newTextColor/30',
        tone === 'warn' && 'bg-[#B191FF]',
        tone === 'bad' && 'bg-red-400',
        tone === 'muted' && 'bg-newTextColor/15'
      )}
    />
    <div className="flex-1 min-w-0">
      <div className="text-[14px] text-newTextColor">
        <span className="text-newTextColor/60">{label}</span>{' '}
        <span className="font-[550]">{verdict}</span>
      </div>
      {!!detail && (
        <div className="text-[12px] text-newTextColor/50 mt-[2px]">{detail}</div>
      )}
    </div>
  </div>
);

export const WeekRun: FC<{ initialWeek: number | null }> = ({ initialWeek }) => {
  const fetch = useFetch();
  const t = useT();
  const [week, setWeek] = useState<number | null>(initialWeek);

  // The proxy answers either an index or one of its named refusals. They are
  // kept apart rather than collapsed into "offline": an org that is not allowed
  // the content pipeline would otherwise be told to go and restart a bridge that
  // is running perfectly well.
  const loadIndex = useCallback(async (): Promise<
    { runs: RunIndexEntry[] } | { error: string; code?: string } | null
  > => {
    try {
      const data = await (await fetch('/copilot/content-runs')).json();
      if (Array.isArray(data?.runs)) return { runs: data.runs };
      if (data?.error) return { error: data.error, code: data.code };
      return null;
    } catch {
      return null;
    }
  }, [fetch]);

  const { data: index } = useSWR('content-runs', loadIndex);
  const runs = index && 'runs' in index ? index.runs : null;

  // With no week in the URL, open on the newest run there is. The index is
  // sorted newest-first by the bridge, so this is its head — the point being
  // that the surface opens on something without the reader having to know which
  // week the last run was.
  const activeWeek = week ?? (runs && runs.length ? runs[0].week : null);

  const loadRun = useCallback(async (): Promise<WeekRunPayload | null> => {
    if (!activeWeek) return null;
    try {
      return await (
        await fetch(`/copilot/content-runs/${activeWeek}`)
      ).json();
    } catch {
      return { error: 'Content bridge is offline', code: 'bridge_offline' } as any;
    }
  }, [fetch, activeWeek]);

  const { data: run, isLoading, mutate: reloadRun } = useSWR(
    activeWeek ? `content-run-${activeWeek}` : null,
    loadRun
  );

  const [approving, setApproving] = useState(false);
  const [approval, setApproval] = useState<null | {
    summary: Record<string, number>;
    posts: { id: string; platform: string | null; outcome: string; reason?: string }[];
    unmatched: { id: string }[];
    error?: string;
  }>(null);

  /** How many posts this click would actually release. Counted from the live
   *  Postiz state the page already fetched, NOT from the record, because the
   *  record cannot know that someone approved three of them by hand an hour ago.
   *  It is the number the confirm names, so it has to be the truth. */
  const awaitingCount = run?.postiz?.awaitingApproval || 0;

  const approveWeek = useCallback(async () => {
    if (!activeWeek || approving) return;
    // Naming the count is the whole point of the confirm: "approve the week" is
    // not a reviewable sentence, "release 14 posts" is. The verification state
    // rides along because approving a week whose record does not match the
    // schedule releases only the part they agree on, and that is exactly the
    // case where a reader should stop.
    //
    // Read off the two failures SEPARATELY rather than off `complete`, which is
    // false for either: an orphaned push does not mean the record and the
    // schedule disagree, and telling the reader it does would send them to
    // rebuild a week whose record is fine. Both cases end at the same place,
    // since this button reaches only the posts in the record, but they are
    // different things to go and check.
    const ver = run?.verification;
    const joinBroken =
      !!ver &&
      (ver.unmatchedCount > 0 || ver.strayCount > 0 || !ver.scheduleReadable);
    // Counted off the list, exactly as the page below counts it, so the confirm
    // can never name a different number from the table it was read from.
    const orphanCount = run?.orphanedPushes?.length || 0;
    const confirmed = await areYouSure({
      title: `${t('release_posts', 'Release')} ${awaitingCount} ${
        awaitingCount === 1 ? t('post', 'post') : t('posts', 'posts')
      }?`,
      description: joinBroken
        ? t(
            'approve_week_incomplete_confirm',
            'The record and the schedule disagree, so scheduled posts missing from this record will NOT be released. Rebuild the week if you need all of it.'
          )
        : orphanCount > 0
        ? `${orphanCount} ${t(
            'approve_week_orphaned_confirm',
            'posts were pushed under ids this record no longer has. This button cannot reach them, so deal with those in Postiz.'
          )}`
        : t(
            'approve_week_confirm',
            'This clears needs-approval and queues them for publishing at their scheduled times.'
          ),
      approveLabel: t('release', 'Release'),
      cancelLabel: t('cancel', 'Cancel'),
    });
    if (!confirmed) {
      return;
    }
    setApproving(true);
    setApproval(null);
    try {
      const res = await (
        await fetch(`/copilot/content-runs/${activeWeek}/approve`, {
          method: 'POST',
        })
      ).json();
      setApproval(res);
    } catch {
      setApproval({
        summary: {},
        posts: [],
        unmatched: [],
        error: t('content_bridge_offline', 'Content bridge is offline'),
      });
    } finally {
      setApproving(false);
      // Refetch either way. A partial success still moved posts, and the page
      // must not keep showing them as awaiting approval.
      reloadRun();
    }
  }, [activeWeek, approving, awaitingCount, fetch, reloadRun, run, t]);

  const byDay = useMemo(() => {
    const groups = new Map<string, RunPost[]>();
    for (const p of run?.posts || []) {
      const key = dayOf(p.datetime) || 'undated';
      groups.set(key, [...(groups.get(key) || []), p]);
    }
    return [...groups.entries()].sort(([a], [b]) =>
      a === 'undated' ? 1 : b === 'undated' ? -1 : a.localeCompare(b)
    );
  }, [run]);

  const picker = !!runs?.length && (
    <select
      value={activeWeek ?? ''}
      onChange={(e) => setWeek(Number(e.target.value))}
      className="h-[32px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] text-newTextColor outline-none"
    >
      {runs.map((r) => (
        <option key={r.week} value={r.week}>
          {t('week', 'Week')} {r.week}
          {r.ok === false ? ' — invalid record' : ''}
        </option>
      ))}
    </select>
  );

  if (index === undefined || isLoading) {
    return (
      <div className="flex flex-col gap-[12px] p-[20px]">
        <Skeleton className="h-[28px] w-[220px]" />
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    );
  }

  if (!runs) {
    return (
      <div className="p-[20px] text-[14px] text-newTextColor/60">
        {(index && 'error' in index && index.error) ||
          t('content_bridge_offline_short', 'Content bridge is offline.')}
      </div>
    );
  }

  if (!activeWeek || !run) {
    // The shared kit, not a hand-rolled column. The hand-rolled version sat
    // hard against the left edge of the card: this slot's parent is a flex ROW
    // (the list and detail panes), so a plain `flex flex-col items-center`
    // child is sized to its content and centres only within its own 542px box
    // rather than the 1190px card. `hero` carries `flex flex-1 items-center
    // justify-center`, which is what makes it fill the row and centre on both
    // axes, and it is the same empty state the rest of the app renders.
    return (
      <EmptyState
        variant="hero"
        icon={
          <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center text-newTextColor/60">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
            </svg>
          </div>
        }
        title={t('no_week_runs_yet', 'No week runs yet')}
        description={t(
          'no_week_runs_yet_description',
          'A run record is written when a week is built. Build one and it will show up here.'
        )}
      />
    );
  }

  // A record that failed its schema is REPORTED, never rendered. The bridge
  // refuses it; this prints what was wrong with it, which is the only useful
  // thing to show and is also the thing that gets it fixed.
  if (run.code === 'invalid_run_record') {
    return (
      <div className="p-[20px] flex flex-col gap-[12px]">
        <div className="flex items-center gap-[12px]">
          <h1 className="text-[20px] font-[600] text-newTextColor">
            {t('week', 'Week')} {activeWeek}
          </h1>
          {picker}
        </div>
        <Panel
          title={t('run_record_rejected', 'This run record was rejected')}
          hint={t(
            'run_record_rejected_hint',
            'It does not match the run record schema, so the week is not shown at all — a partly-read record would hide whichever part failed.'
          )}
        >
          <ul className="flex flex-col gap-[6px]">
            {(run.violations || []).map((v, i) => (
              <li key={i} className="text-[14px] text-red-400">
                {v}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    );
  }

  if (run.error || !run.record) {
    return (
      <div className="p-[20px] flex flex-col gap-[12px]">
        <div className="flex items-center gap-[12px]">
          <h1 className="text-[20px] font-[600] text-newTextColor">
            {t('week', 'Week')} {activeWeek}
          </h1>
          {picker}
        </div>
        <div className="text-[14px] text-newTextColor/60">
          {run.error ||
            t('content_bridge_offline_short', 'Content bridge is offline.')}
        </div>
      </div>
    );
  }

  const v = run.verification;
  const p = run.postiz;
  const broken = v.unmatchedCount > 0 || v.strayCount > 0 || !v.scheduleReadable;
  // Kept OUT of `broken`, which is about the record disagreeing with the
  // schedule. An orphaned push is the failure where those two agree perfectly
  // and a post is live in Postiz anyway, so it gets its own sentence everywhere
  // rather than being folded into a count of mismatches. Read once, from the
  // list, so the pill, the banner, the check and the table cannot disagree.
  const orphaned = run.orphanedPushes || [];
  const orphanCount = orphaned.length;
  // Kept SEPARATE from `orphaned` on purpose. An orphan is a post we know is
  // live in Postiz with nobody watching it; an uncertain row may have created
  // nothing at all. Merging them would make the count louder and less true, and
  // this section is only worth having if a red number means one specific thing.
  const uncertain = run.uncertainPushes || [];

  return (
    <div className="flex flex-col gap-[16px] p-[20px] phone:px-[16px]">
      {/* ---- header: the week, and every reason not to trust it at a glance ---- */}
      <header className="flex flex-col gap-[10px]">
        <div className="flex items-center gap-[12px] flex-wrap">
          <h1 className="text-[20px] font-[600] text-newTextColor">
            {t('week', 'Week')} {run.week}
          </h1>
          <span className="text-[14px] text-newTextColor/60">
            {weekRange(run.record.weekMonday)}
          </span>
          {picker}
          {/* This route used to be the chat's; the way back stays one click
              away so nothing that pointed here is stranded. */}
          <Link
            href="/agents/new?mode=content"
            className="text-[14px] text-newTextColor/60 hover:text-newTextColor transition-colors duration-150"
          >
            {t('open_in_ace', 'Open Ace')}
          </Link>
        </div>
        <div className="flex items-center gap-[8px] flex-wrap">
          {broken ? (
            <Pill tone="bad">
              {v.unmatchedCount > 0
                ? `${v.unmatchedCount} ${t(
                    'unmatched_posts',
                    'scheduled posts missing from this record'
                  )}`
                : !v.scheduleReadable
                ? t('schedule_unreadable', 'the schedule could not be read')
                : `${v.strayCount} ${t(
                    'stray_posts',
                    'posts in the record that the schedule no longer has'
                  )}`}
            </Pill>
          ) : orphanCount === 0 ? (
            <Pill tone="ok">
              {run.posts.length}{' '}
              {t('posts_all_matched', 'posts, all matched to the schedule')}
            </Pill>
          ) : null}
          {/* Its own pill, never a branch of the one above: the chain there
              shows a single reason and would swallow this behind an unmatched
              count, and this is the reason with something live at the end of
              it. When it is the ONLY problem, the all-matched pill is
              suppressed above rather than shown next to it, because the record
              matching the schedule is true and beside the point. */}
          {orphanCount > 0 && (
            <Pill tone="bad">
              {orphanCount}{' '}
              {t(
                'orphaned_pushes',
                'pushed posts this record no longer accounts for'
              )}
            </Pill>
          )}
          {v.contentEdited && (
            <Pill tone="warn">
              {t('copy_edited_since_run', 'copy edited since the run')}
            </Pill>
          )}
          {v.scheduleEdited && (
            <Pill tone="warn">
              {t('schedule_edited_since_run', 'schedule edited since the run')}
            </Pill>
          )}
          {run.handoffs.length > 0 && (
            <Pill tone="warn">
              {run.handoffs.length} {t('manual_handoffs', 'manual handoffs')}
            </Pill>
          )}
          {p?.gateOn && p.awaitingApproval > 0 && (
            <Pill tone="warn">
              {p.awaitingApproval} {t('awaiting_approval', 'awaiting approval')}
            </Pill>
          )}
          {!run.authored && (
            <Pill tone="muted">
              {t('partially_authored', 'partially authored — Ace left no account')}
            </Pill>
          )}
          {run.accountStale && (
            <Pill tone="warn">
              {t('account_is_stale', 'Ace’s account predates this build')}
            </Pill>
          )}
        </div>
        {broken && (
          <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 px-[12px] py-[10px] text-[13px] text-red-400 leading-[1.55]">
            {t(
              'week_run_incomplete_warning',
              'This is NOT a complete picture of the week. The record and the schedule disagree, so anything below is only the part they have in common — do not approve the week from this page until it is rebuilt.'
            )}
          </div>
        )}
        {/* A second banner rather than a clause in the first, because the two
            say different things and one of them names work outside this page.
            A stray is a record that overstates itself; this is a post that
            exists in Postiz, may be queued to publish, and is reachable from
            nothing here except the id in the table below. */}
        {orphanCount > 0 && (
          <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 px-[12px] py-[10px] text-[13px] text-red-400 leading-[1.55]">
            {orphanCount}{' '}
            {t(
              'orphaned_pushes_warning',
              'posts were pushed to Postiz and then dropped or renamed by a rebuild. They are still there, they may still be queued to publish, and nothing on this page schedules them any more. Open each one in Postiz by the id below and delete it, or rebuild and re-push the week so it owns them again. Releasing this week does not touch them.'
            )}
          </div>
        )}

        {/* RELEASING the week lives on the page that just showed the evidence,
            which is the entire argument for this surface: a read-only report you
            have to remember to open loses to a busy week, and the approving goes
            back to happening one calendar card at a time somewhere else.
            Shown only when the gate is on AND something is actually held, so it
            is never a control that does nothing. The count comes from live
            Postiz state rather than the record, because the record cannot know
            that someone released three of them by hand an hour ago. */}
        {run.postiz?.gateOn && awaitingCount > 0 && (
          <div className="flex items-center gap-[12px] flex-wrap">
            <Button onClick={approveWeek} disabled={approving}>
              {approving
                ? t('releasing', 'Releasing…')
                : `${t('release_posts', 'Release')} ${awaitingCount} ${
                    awaitingCount === 1 ? t('post', 'post') : t('posts', 'posts')
                  }`}
            </Button>
            <span className="text-[13px] text-newTextColor/50">
              {t(
                'release_posts_hint',
                'Clears needs-approval and queues them for publishing. Already-queued posts are untouched.'
              )}
            </span>
          </div>
        )}

        {/* Per-post outcomes, never a bare count: a week where three posts
            quietly failed to approve is worse than an error, so every refusal
            is named with its reason. */}
        {approval && (
          <div className="rounded-[10px] border border-newTableBorder bg-newBgColorInner px-[12px] py-[10px] text-[13px] leading-[1.6]">
            {approval.error ? (
              <div className="text-red-400">{approval.error}</div>
            ) : (
              <>
                <div className="font-[550] mb-[6px]">
                  {t('released', 'Released')} {approval.summary?.approved ?? 0}
                  {(approval.summary?.alreadyQueued ?? 0) > 0 &&
                    `, ${approval.summary.alreadyQueued} ${t(
                      'already_queued',
                      'already queued'
                    )}`}
                  {(approval.summary?.refused ?? 0) > 0 &&
                    `, ${approval.summary.refused} ${t('refused', 'refused')}`}
                </div>
                {approval.posts
                  ?.filter(
                    (o) => o.outcome !== 'approved' && o.outcome !== 'already_queued'
                  )
                  .map((o) => (
                    <div key={o.id} className="text-newTextColor/60">
                      {o.id}
                      {o.platform ? ` · ${o.platform}` : ''} — {o.outcome}
                      {o.reason ? `: ${o.reason}` : ''}
                    </div>
                  ))}
                {approval.unmatched?.length > 0 && (
                  <div className="text-red-400 mt-[6px]">
                    {approval.unmatched.length}{' '}
                    {t(
                      'scheduled_posts_not_in_record',
                      'scheduled posts are not in this record and were NOT released'
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </header>

      {/* ---- the checkable half ---- */}
      <Panel
        title={t('checked_in_code', 'Checked in code')}
        hint={t(
          'checked_in_code_hint',
          'Re-derived from the files and the database when this page loaded. None of it is the agent’s account of itself.'
        )}
      >
        <Check
          label={t('post_set', 'Post set:')}
          tone={broken ? 'bad' : 'ok'}
          verdict={
            !v.scheduleReadable
              ? t('could_not_be_read', 'could not be read')
              : broken
              ? `${v.unmatchedCount} unmatched, ${v.strayCount} stray`
              : `${run.posts.length} posts, every scheduled id present`
          }
          detail={
            v.scheduleProblem ||
            (broken
              ? [
                  ...run.unmatched.map(
                    (u) => `${u.id} is scheduled but not in this record`
                  ),
                  ...run.stray.map(
                    (id) => `${id} is in this record but not in the schedule`
                  ),
                ].join(' · ')
              : undefined)
          }
        />
        <Check
          label={t('copy_check', 'Copy:')}
          tone={v.contentEdited ? 'warn' : v.contentEdited === null ? 'muted' : 'ok'}
          verdict={
            v.contentMissing
              ? t('no_content_file', 'no content.json for this week')
              : v.contentEdited === null
              ? t('nothing_to_compare', 'nothing to compare')
              : v.contentEdited
              ? t('edited_since_run', 'edited since the run')
              : t('unchanged_since_run', 'unchanged since the run')
          }
          detail={
            v.contentEdited
              ? t(
                  'copy_edited_detail',
                  'The captions on this page are the ones the run recorded. What is on disk now differs, and what was pushed may differ from both.'
                )
              : undefined
          }
        />
        <Check
          label={t('times', 'Times:')}
          tone={v.datetimeChangedCount > 0 ? 'warn' : 'ok'}
          verdict={
            v.datetimeChangedCount > 0
              ? `${v.datetimeChangedCount} ${t(
                  'moved_since_run',
                  'moved since the run'
                )}`
              : t('as_recorded', 'as recorded')
          }
        />
        {/* `present` is about the posts THIS record holds, so a week whose
            pushes were all orphaned by a rebuild reports "not pushed yet" while
            every one of them sits in Postiz. That is the reading this row must
            never hand back on its own, so the orphan count is stated beside it
            and outranks it for tone. */}
        <Check
          label={t('pushed', 'Pushed:')}
          tone={
            orphanCount > 0
              ? 'bad'
              : !v.push.present
              ? 'muted'
              : v.push.byStatus.failed || v.push.byStatus.unmapped
              ? 'bad'
              : 'ok'
          }
          verdict={[
            !v.push.present
              ? t('not_pushed_yet', 'not pushed yet')
              : Object.entries(v.push.byStatus)
                  .map(([k, n]) => `${n} ${k}`)
                  .join(', '),
            orphanCount > 0
              ? `${orphanCount} ${t(
                  'orphaned_pushes_short',
                  'pushed under an id this record no longer has'
                )}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          detail={
            [
              orphanCount > 0
                ? t(
                    'orphaned_pushes_detail',
                    'Those are live in Postiz with nothing here pointing at them. They are listed under the week below.'
                  )
                : '',
              v.push.present && v.push.unlinked > 0
                ? `${v.push.unlinked} ${t(
                    'not_linked_to_postiz',
                    'of them carry no Postiz id, so their live state cannot be checked from here. Weeks pushed before 12 Aug 2026 never recorded one.'
                  )}`
                : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
        {!!p && (
          <Check
            label={t('in_postiz', 'In Postiz:')}
            tone={
              p.missing > 0 || p.errored > 0 || p.dateMismatch > 0
                ? 'bad'
                : p.linked === 0
                ? 'muted'
                : p.awaitingApproval > 0
                ? 'warn'
                : 'ok'
            }
            verdict={
              p.linked === 0
                ? t('nothing_linked', 'nothing to look up')
                : [
                    `${p.found}/${p.linked} found`,
                    p.awaitingApproval ? `${p.awaitingApproval} awaiting approval` : '',
                    p.queued ? `${p.queued} queued` : '',
                    p.published ? `${p.published} published` : '',
                    p.errored ? `${p.errored} errored` : '',
                    p.missing ? `${p.missing} not found` : '',
                    p.deleted ? `${p.deleted} deleted` : '',
                    p.undated ? `${p.undated} undated` : '',
                    p.dateMismatch ? `${p.dateMismatch} at a different time` : '',
                  ]
                    .filter(Boolean)
                    .join(', ')
            }
            detail={
              p.linked === 0
                ? undefined
                : p.gateOn
                ? t(
                    'approval_gate_on',
                    'This organization requires approval, so a post stays a draft until an approver releases it.'
                  )
                : t(
                    'approval_gate_off',
                    'This organization does not require approval, so nothing here was gated.'
                  )
            }
          />
        )}
      </Panel>

      {/* ---- handoffs: what a human still has to do ---- */}
      <Panel
        title={t('handoffs_for_a_human', 'Handoffs for a human')}
        hint={t(
          'handoffs_hint',
          'Computed from the week’s copy and platform routing, not declared by the agent.'
        )}
        right={
          <Pill tone={run.handoffs.length ? 'warn' : 'ok'}>
            {run.handoffs.length}
          </Pill>
        }
      >
        {!run.handoffs.length ? (
          <div className="text-[14px] text-newTextColor/60">
            {t('no_handoffs', 'Nothing in this week needs a human step.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead className="bg-newTableHeader">
                <tr>
                  <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                    {t('post', 'Post')}
                  </th>
                  <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                    {t('what_is_needed', 'What is needed')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {run.handoffs.map((h, i) => (
                  <tr key={`${h.id}-${h.kind}-${i}`}>
                    <td className="border border-newTableBorder px-[10px] py-[6px] align-top whitespace-nowrap">
                      <div className="font-[550]">{h.id}</div>
                      <div className="text-[12px] text-newTextColor/50">
                        {h.platform || '—'} · {h.kind}
                      </div>
                    </td>
                    <td className="border border-newTableBorder px-[10px] py-[6px] align-top text-newTextColor/80">
                      {h.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ---- the week itself ---- */}
      <Panel
        title={t('the_week', 'The week')}
        hint={
          run.record.timezone
            ? t('times_are_local', 'Times are as scheduled') +
              ` (UTC${run.record.timezone})`
            : undefined
        }
        right={
          <Pill tone="muted">
            {Object.entries(run.record.counts?.byPlatform || {})
              .map(([k, n]) => `${k} ${n}`)
              .join(' · ')}
          </Pill>
        }
      >
        <div className="flex flex-col gap-[16px]">
          {byDay.map(([day, posts]) => (
            <div key={day}>
              <div className="text-[13px] font-[600] text-newTextColor/70 mb-[6px]">
                {day === 'undated' ? t('no_date', 'No date') : prettyDay(day)}
                {run.record.campaignDate === day && (
                  <span className="ms-[8px] text-[12px] font-[500] text-[#B191FF]">
                    {t('campaign_day', 'campaign')}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead className="bg-newTableHeader">
                    <tr>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550] w-[70px]">
                        {t('time', 'Time')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                        {t('post', 'Post')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550] w-[120px]">
                        {t('copy', 'Copy')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550] w-[190px]">
                        {t('state', 'State')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td className="border border-newTableBorder px-[10px] py-[6px] align-top whitespace-nowrap">
                          {timeOf(post.datetime)}
                          {post.datetimeChanged && (
                            <div className="text-[12px] text-[#B191FF]">
                              {t('now', 'now')} {timeOf(post.scheduleDatetime)}
                            </div>
                          )}
                        </td>
                        <td className="border border-newTableBorder px-[10px] py-[6px] align-top">
                          <div className="font-[550]">{post.id}</div>
                          <div className="text-[12px] text-newTextColor/50">
                            {post.platform} · {post.type}
                            {post.media.length > 1
                              ? ` · ${post.media.length} ${t('files', 'files')}`
                              : ''}
                            {post.resharesOf
                              ? ` · ${t('reshare_of', 'reshare of')} ${post.resharesOf}`
                              : ''}
                          </div>
                        </td>
                        <td className="border border-newTableBorder px-[10px] py-[6px] align-top">
                          <div className="flex flex-wrap gap-[4px]">
                            {post.needsCopy ? (
                              <Pill tone="bad">{t('no_caption', 'no caption')}</Pill>
                            ) : post.hasCaption ? (
                              <Pill tone="muted">{post.captionChars}</Pill>
                            ) : (
                              <Pill tone="muted">{t('visual', 'visual')}</Pill>
                            )}
                            {post.hasFirstComment && (
                              <Pill tone="muted">{t('comment', 'comment')}</Pill>
                            )}
                            {post.hasCaption && !post.hasAltText && (
                              <Pill tone="warn">{t('no_alt', 'no alt')}</Pill>
                            )}
                          </div>
                        </td>
                        <td className="border border-newTableBorder px-[10px] py-[6px] align-top">
                          <PostState post={post} t={t} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Scheduled posts this record says nothing about. Listed WITH the
              week rather than in a footnote: they are part of what publishes. */}
          {!!run.unmatched.length && (
            <div>
              <div className="text-[13px] font-[600] text-red-400 mb-[6px]">
                {t('not_in_this_record', 'Scheduled, but not in this record')} (
                {run.unmatched.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <tbody>
                    {run.unmatched.map((u) => (
                      <tr key={u.id}>
                        <td className="border border-newTableBorder px-[10px] py-[6px] w-[70px] whitespace-nowrap">
                          {timeOf(u.datetime)}
                        </td>
                        <td className="border border-newTableBorder px-[10px] py-[6px]">
                          <span className="font-[550]">{u.id}</span>
                          <span className="text-[12px] text-newTextColor/50">
                            {' '}
                            {u.platform || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pushed, and then dropped by a rebuild. Listed WITH the week for the
              same reason as the block above, that it is part of what publishes,
              and last, because unlike everything else on this page these rows
              are not fixed from this page. The Postiz id is the point of the
              table: it is the only handle left on the post. */}
          {!!orphaned.length && (
            <div>
              <div className="text-[13px] font-[600] text-red-400 mb-[2px]">
                {t('pushed_not_in_record', 'Pushed, but not in this record')} (
                {orphaned.length})
              </div>
              <div className="text-[12px] text-newTextColor/50 mb-[6px]">
                {t(
                  'pushed_not_in_record_hint',
                  'Open each one in Postiz by its id. Releasing this week does not reach them.'
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead className="bg-newTableHeader">
                    <tr>
                      {/* No fixed width, and nowrap: at 402px a two-word header
                          in a 70px column wraps to two lines, and the cells
                          under it carry a date as well as a time. The column
                          sizes itself to the widest of the three. */}
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550] whitespace-nowrap">
                        {t('pushed_for_column', 'Pushed for')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                        {t('post', 'Post')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                        {t('postiz_id', 'Postiz id')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphaned.map((o) => {
                      // Dated here rather than under a day heading like the rest
                      // of the week: these rows belong to no day the record
                      // still claims, so the date has to travel with the row.
                      const day = dayOf(o.pushedFor);
                      return (
                        <tr key={o.id}>
                          <td className="border border-newTableBorder px-[10px] py-[6px] align-top whitespace-nowrap">
                            {timeOf(o.pushedFor)}
                            {!!day && (
                              <div className="text-[12px] text-newTextColor/50">
                                {prettyDay(day)}
                              </div>
                            )}
                          </td>
                          <td className="border border-newTableBorder px-[10px] py-[6px] align-top">
                            <div className="font-[550] break-all">{o.id}</div>
                            {/* The distinction the row exists for: whether the
                                week still publishes this thing under a name the
                                record lost, or whether nothing anywhere but this
                                line knows about it. */}
                            <div className="text-[12px] text-newTextColor/50">
                              {o.status} ·{' '}
                              {o.inSchedule
                                ? t(
                                    'orphan_still_scheduled',
                                    'still in the schedule, missing only from the record'
                                  )
                                : t(
                                    'orphan_only_mention',
                                    'in neither the record nor the schedule'
                                  )}
                            </div>
                          </td>
                          <td className="border border-newTableBorder px-[10px] py-[6px] align-top break-all">
                            {o.postizId || (
                              <span className="text-[12px] text-newTextColor/40">
                                {t(
                                  'no_postiz_id',
                                  'none recorded, pushed before ids were captured'
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Uncertain pushes. Deliberately amber, not red, and worded as a
              question rather than a statement: the whole point of the field is
              that we do NOT know whether these created anything. `lastError` is
              the only thing that separates "refused before it left the machine"
              from "the create may have landed and the answer never came back",
              so it is shown verbatim rather than summarised. */}
          {!!uncertain.length && (
            <div>
              <div className="text-[13px] font-[600] text-yellow-500 mb-[2px]">
                {t('uncertain_pushes', 'May have been pushed, unconfirmed')} (
                {uncertain.length})
              </div>
              <div className="text-[12px] text-newTextColor/50 mb-[6px]">
                {t(
                  'uncertain_pushes_hint',
                  'These runs failed or stopped without recording a Postiz id. Some never sent anything; others may have created a post whose answer never arrived. Check Postiz before re-pushing them.'
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-newTextColor/60">
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550] whitespace-nowrap">
                        {t('pushed_for_column', 'Pushed for')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                        {t('post', 'Post')}
                      </th>
                      <th className="border border-newTableBorder px-[10px] py-[6px] text-start font-[550]">
                        {t('last_error', 'Last error')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncertain.map((u) => {
                      const day = dayOf(u.pushedFor);
                      return (
                        <tr key={u.id}>
                          <td className="border border-newTableBorder px-[10px] py-[6px] align-top whitespace-nowrap">
                            {timeOf(u.pushedFor)}
                            {!!day && (
                              <div className="text-[12px] text-newTextColor/50">
                                {prettyDay(day)}
                              </div>
                            )}
                          </td>
                          <td className="border border-newTableBorder px-[10px] py-[6px] align-top">
                            <div className="font-[550] break-all">{u.id}</div>
                            <div className="text-[12px] text-newTextColor/50">
                              {u.status} ·{' '}
                              {u.inSchedule
                                ? t('uncertain_in_schedule', 'still in the schedule')
                                : t('uncertain_not_in_schedule', 'no longer in the schedule')}
                            </div>
                          </td>
                          <td className="border border-newTableBorder px-[10px] py-[6px] align-top break-all text-newTextColor/70">
                            {u.lastError || (
                              <span className="text-[12px] text-newTextColor/40">
                                {t('no_error_recorded', 'no error recorded')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* ---- the agent-authored half, fenced off and labelled ---- */}
      <section className="rounded-[12px] border border-dashed border-newTableBorder bg-newBgColorInner">
        <div className="px-[16px] py-[12px] border-b border-newTableBorder border-dashed">
          <div className="text-[14px] font-[600] text-newTextColor">
            {t('ace_own_account', 'Ace’s own account of this run')}
          </div>
          <div className="text-[12px] text-newTextColor/50 mt-[2px]">
            {t(
              'ace_own_account_hint',
              'Written by Ace at the end of the run. Nothing below is checked by anything — it is the agent describing itself, and it is shown separately for that reason.'
            )}
          </div>
        </div>
        <div className="p-[16px]">
          {run.accountStale && (
            <div className="mb-[12px] rounded-[10px] border border-[#B191FF]/30 bg-[#B191FF]/5 px-[12px] py-[10px] text-[13px] text-[#B191FF] leading-[1.55]">
              {t(
                'account_is_stale_detail',
                'This account was written before the record above was built, so it is about an earlier version of this week. Read it as history, not as an explanation of what is scheduled now.'
              )}
            </div>
          )}
          {!!run.accountViolations.length && (
            <div className="mb-[12px] text-[13px] text-red-400">
              {t(
                'account_rejected',
                'Ace left an account, but it was rejected:'
              )}{' '}
              {run.accountViolations.join('; ')}
            </div>
          )}
          {!run.account ? (
            <div className="text-[14px] text-newTextColor/60">
              {t(
                'no_account_written',
                'Ace did not write an account of this run. The record above still stands — it is built from the files either way — but there is no stated reasoning to read.'
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-[14px]">
              <div>
                <div className="text-[12px] font-[600] text-newTextColor/60 uppercase tracking-[0.04em] mb-[4px]">
                  {t('rationale_claimed', 'Rationale (claimed)')}
                </div>
                <div className="text-[14px] leading-[1.6] text-newTextColor/80 whitespace-pre-wrap">
                  {run.account.rationale}
                </div>
              </div>
              <div>
                <div className="text-[12px] font-[600] text-newTextColor/60 uppercase tracking-[0.04em] mb-[4px]">
                  {t('sources_claimed', 'Sources (claimed)')}
                </div>
                {!run.account.sources.length ? (
                  <div className="text-[14px] text-newTextColor/50">
                    {t('none_listed', 'None listed.')}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-[4px]">
                    {run.account.sources.map((s, i) => (
                      <li key={i} className="text-[14px] text-newTextColor/80">
                        <span className="font-[550]">{s.what}</span>
                        <span className="text-newTextColor/50"> — {s.where}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-[4px]">
                <div className="text-[12px] font-[600] text-newTextColor/60 uppercase tracking-[0.04em]">
                  {t('self_reported', 'Self-reported')}
                </div>
                <div className="text-[14px] text-newTextColor/80">
                  {t('confidence', 'Confidence')}:{' '}
                  <span className="font-[550]">{run.account.confidence}</span>
                </div>
                {/* An empty `unverified` is stated plainly rather than shown as a
                    clean result. It is the field a run in a hurry leaves bare,
                    so silence here is not evidence of anything. */}
                {!run.account.unverified.length ? (
                  <div className="text-[14px] text-newTextColor/50">
                    {t(
                      'nothing_listed_unverified',
                      'Ace listed nothing as unverified. That is a claim, not a result.'
                    )}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-[4px] mt-[2px]">
                    {run.account.unverified.map((u, i) => (
                      <li key={i} className="text-[14px] text-newTextColor/80">
                        • {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="text-[12px] text-newTextColor/40">
        {t('record_built_by', 'Record built by')} {run.record.generator} ·{' '}
        {run.record.builtAt.replace('T', ' ').slice(0, 16)} UTC ·{' '}
        {run.schemaVersion}
      </footer>
    </div>
  );
};

/** What Postiz holds for one post, in the fewest words that stay honest.
 *  `not linked` and `not found` are deliberately different: the first means this
 *  week never recorded an id to look up (every week pushed before 12 Aug 2026),
 *  the second means an id was recorded and Postiz has no such post for this org. */
const PostState: FC<{ post: RunPost; t: ReturnType<typeof useT> }> = ({
  post,
  t,
}) => {
  if (!post.push) {
    return <Pill tone="muted">{t('not_pushed', 'not pushed')}</Pill>;
  }
  const pz = post.postiz;
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex flex-wrap gap-[4px]">
        <Pill
          tone={
            post.push.status === 'scheduled'
              ? 'ok'
              : post.push.status === 'pending'
              ? 'muted'
              : 'bad'
          }
        >
          {post.push.status}
        </Pill>
        {post.push.drift && (
          <Pill tone="warn">
            {t('pushed_for', 'pushed for')} {timeOf(post.push.pushedFor)}
          </Pill>
        )}
      </div>
      {!pz ? (
        <span className="text-[12px] text-newTextColor/40">
          {t('not_linked', 'not linked to Postiz')}
        </span>
      ) : !('found' in pz) ? (
        <span className="text-[12px] text-newTextColor/40">
          {t('not_looked_up', 'not looked up')}
        </span>
      ) : !pz.found ? (
        <span className="text-[12px] text-red-400">
          {t('not_in_postiz', 'no such post in this organization')}
        </span>
      ) : (
        <div className="flex flex-wrap gap-[4px]">
          <Pill
            tone={
              pz.deleted || pz.state === 'ERROR'
                ? 'bad'
                : pz.needsApproval
                ? 'warn'
                : 'ok'
            }
          >
            {pz.deleted
              ? t('deleted', 'deleted')
              : pz.needsApproval
              ? t('needs_approval', 'needs approval')
              : pz.state.toLowerCase()}
          </Pill>
          {!pz.publishDate && (
            <Pill tone="warn">{t('undated', 'undated')}</Pill>
          )}
          {pz.dateMatches === false && (
            <Pill tone="bad">{t('different_time', 'different time')}</Pill>
          )}
        </div>
      )}
      {!!post.push.lastError && (
        <span className="text-[12px] text-red-400">{post.push.lastError}</span>
      )}
    </div>
  );
};
