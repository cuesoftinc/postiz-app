'use client';

import dynamic from 'next/dynamic';

const RenderPreviewDate = dynamic(
  () =>
    import('@gitroom/frontend/components/preview/render.preview.date').then(
      (mod) => mod.RenderPreviewDate
    ),
  { ssr: false }
);

/**
 * `date` is nullable for the same reason it is on the component this wraps:
 * `Post.publishDate` is nullable, and `strictNullChecks` is off, so a `string`
 * here was a claim the compiler could never test. The only caller today drops
 * the whole row for a dateless post, so nothing passes null through yet — this
 * closes the lie before it becomes reachable.
 *
 * The empty case is handled by forwarding it: RenderPreviewDate already prints
 * the `no_publication_date` fallback rather than dayjs's 'Invalid Date'
 * sentinel, and repeating that test here would be a second copy to keep in step.
 */
export const RenderPreviewDateClient = ({
  date,
}: {
  date?: string | null;
}) => {
  return <RenderPreviewDate date={date} />;
};
