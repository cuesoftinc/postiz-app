'use client';

import { FC } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
dayjs.extend(utc);

/**
 * `date` is nullable because `Post.publishDate` is: an undated draft is a
 * captured idea with no slot committed yet. The prop used to be typed `string`,
 * which the compiler could not contradict (strictNullChecks is off), and
 * `dayjs.utc(null).format(...)` returns the literal string 'Invalid Date' — on
 * the PUBLIC share page that shipped as "Publication Date: Invalid Date".
 *
 * Callers are expected to omit this row entirely when there is no date (see
 * p/[id]/page.tsx); the fallback here exists so that no other caller can print
 * the sentinel either.
 *
 * `.local()` is kept deliberately. This is a public share link, so the right
 * reading is the VIEWER's machine clock, not any stored display-zone
 * preference — and the parse stays `dayjs.utc()` so a naive server string is
 * read as UTC rather than as machine-local.
 */
export const RenderPreviewDate: FC<{ date?: string | null }> = ({ date }) => {
  const t = useT();
  const parsed = date ? dayjs.utc(date) : null;

  if (!parsed?.isValid()) {
    return <>{t('no_publication_date', 'No date set')}</>;
  }

  return <>{parsed.local().format('MMMM D, YYYY h:mm A')}</>;
};
