/**
 * Cuesoft fork — shared loading primitives (UI-CONSISTENCY-PLAN row 8).
 *
 * Successor to the two primitives in `components/layout/loading.tsx`
 * (upstream file — never edit it; it stays for the sites we have not
 * migrated). Why `Loader` re-implements the 10-line spinner div instead of
 * delegating to the upstream `Spinner`:
 *
 *  - upstream hardcodes `borderWidth = max(2, size / 8)`, which renders a
 *    chunky 3px ring at 20px and a 13px ring at 100px. The plan calls out a
 *    saner formula as a deliberate change: `clamp(2, size / 10, 6)`.
 *  - upstream still accepts a dead `type="spin"` prop left over from the
 *    removed `react-loading` dependency; this API drops it.
 *
 * Both components use the `spin` keyframe from `app/global.scss` (the same
 * one the upstream Spinner uses) via an inline style, so no Tailwind
 * `animate-spin` class is involved.
 *
 * Size-ladder note: no class used here matches the global.scss rescale
 * ladder (`py-[40px]` is not a ladder token), so no `data-cs` opt-out is
 * needed.
 */
import { CSSProperties, FC } from 'react';
import clsx from 'clsx';

/**
 * One spinner primitive. Replaces the raw `Spinner` default export of
 * `layout/loading.tsx` (dead `type` prop) and the six hand-rolled
 * `animate-spin` border-circle divs.
 */
export const Loader: FC<{
  /** Diameter in px. Ring width derives as clamp(2, size / 10, 6). */
  size?: number;
  /** Ring color. Defaults to brand blue (#325ea6) — the contract's
   *  informational accent, legible on both themes. */
  color?: string;
  className?: string;
}> = ({ size = 24, color = '#325ea6', className }) => {
  const borderWidth = Math.min(6, Math.max(2, Math.round(size / 10)));

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid transparent`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
};

/**
 * A Loader truly centered in a pane. Supersedes `LoadingComponent` (whose
 * baked-in `pt-[100px]` lands the spinner at a different vertical position
 * in every container — wrapcaster.provider cancels it with `-mt-[90px]`) and
 * the four divergent wrapper divs around it. Deliberate change per the plan:
 * consistent vertical placement (`items-center justify-center` + `flex-1`),
 * with `py-[40px]` breathing room when the container hugs its content
 * (modal loading, the statistics.tsx idiom).
 */
export const LoadingPane: FC<{
  /**
   * Reserves vertical space in containers that are not flex-stretched
   * (e.g. modal bodies). Number = px, string = any CSS length.
   */
  minHeight?: number | string;
  /** Spinner diameter; 100 matches the LoadingComponent default it replaces. */
  size?: number;
  /** Forwarded to Loader; defaults to brand blue (#325ea6). */
  color?: string;
  className?: string;
}> = ({ minHeight, size = 100, color, className }) => {
  const style: CSSProperties | undefined =
    minHeight !== undefined ? { minHeight } : undefined;

  return (
    <div
      className={clsx(
        'flex flex-1 items-center justify-center py-[40px]',
        className
      )}
      style={style}
    >
      <Loader size={size} color={color} />
    </div>
  );
};
