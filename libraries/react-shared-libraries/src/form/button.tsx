'use client';

import {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  FC,
  useEffect,
  useRef,
  useState,
} from 'react';
import { clsx } from 'clsx';
const ReactLoading = ({ color = 'currentColor', width = 20, height = 20 }: { type?: string; color?: string; width?: number; height?: number }) => {
  const size = Math.min(width, height);
  const borderWidth = Math.max(2, Math.round(size / 8));
  return (
    <div
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
 * Buffer's button hierarchy, measured live 2026-08-13 at 1440x807. It is ONE
 * system with a height-to-radius rule: at 40px height the radius is 12, at 32px
 * it is 8. That rule is why the variants below cannot share a single frame
 * string: a secondary button must take radius 8, not inherit the primary's 12.
 *
 *   primary   40 / r12 / padding 0 16 / gap 8 / lime fill / dark label
 *   secondary 32 / r8  / padding 0 12 / gap 4 / transparent + hairline border
 *   danger    the primary FRAME (a destructive confirm is a full-weight CTA)
 *             with the fork's critical ink as the fill
 *
 * Brand mapping: Buffer's green #b0ec9c becomes the kit's lime (`bg-btnPrimary`,
 * #bfff72) and its hairline #dedcd9 becomes `border-newTableBorder`, which
 * composites to exactly #dedcd9 over the cream canvas. Every other value here is
 * Buffer's own measured number.
 *
 * The primary label ink is NOT set here on purpose: global.scss forces
 * `[class*="bg-btnPrimary"] { color: #000 !important }` because lime is a light
 * field, and that rule outranks anything this component could author (equal
 * specificity, emitted after the utilities layer). Buffer measures #292928; we
 * render #000. See the report handoff if that one step matters.
 *
 * Buffer's remaining two levels, GHOST (32/r8, no fill, no border, muted label
 * #5a5a59) and GHOST ACTIVE (+ #d9f1d1 fill, #337046 label), are deliberately
 * absent: they have no consumer through this primitive today, and the six
 * hand-rolled segmented controls that would want them own their own markup.
 */
const VARIANTS = {
  primary: {
    frame: 'h-[40px] rounded-[12px] px-[16px] bg-btnPrimary',
    gap: 'gap-[8px]',
  },
  danger: {
    frame: 'h-[40px] rounded-[12px] px-[16px] bg-[#FF3F3F] text-white',
    gap: 'gap-[8px]',
  },
  secondary: {
    frame:
      'h-[32px] rounded-[8px] px-[12px] bg-transparent border border-newTableBorder text-newTextColor',
    gap: 'gap-[4px]',
  },
} as const;

export const Button: FC<
  DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > & {
    secondary?: boolean;
    /**
     * Destructive confirms. Without this the only variants were "lime primary"
     * and "hairline secondary", so a DELETE action had to render in the loud
     * brand colour or hand-roll its own red, and in the tag-delete confirm the
     * lime button ended up being CANCEL, which is a mis-click waiting to
     * happen. Buffer's delete confirm is red regardless of measurement.
     *
     * Ink is the kit's own critical tone #FF3F3F (the value already used for
     * every destructive affordance in the fork: sidebar Log out, Delete Post,
     * the calendar kebab's Delete, provider disconnect) rather than Buffer's
     * measured #94120e. Buffer measures that value as destructive TEXT on
     * white; as a filled button it would be a near-maroon that belongs to no
     * other control here, and the brand-mapping rule only substitutes Cuesoft
     * colour for Buffer's green and blue; it does not license importing a
     * Buffer neutral that contradicts the kit's existing critical ink. White
     * ink because #FF3F3F is a mid-dark field, unlike lime.
     */
    danger?: boolean;
    loading?: boolean;
    innerClassName?: string;
  }
> = ({ children, loading, innerClassName, secondary, danger, ...props }) => {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    setHeight(ref.current?.offsetHeight || 40);
  }, []);
  // danger is resolved BEFORE secondary, as it was before: a button marked both
  // is a destructive confirm first and foremost.
  const variant =
    VARIANTS[danger ? 'danger' : secondary ? 'secondary' : 'primary'];
  return (
    <button
      {...props}
      type={props.type || 'button'}
      ref={ref}
      // data-cs is the only reason 40px survives: global.scss rescales any
      // element WITHOUT it, and `h-[40px]` is on that ladder (-> 32px). That is
      // why this button shipped 8px shorter than it read in source, with a
      // radius and padding nobody had revisited since. The opt-out also means
      // the ladder no longer rewrites anything a CALL SITE passes through
      // className (a `rounded-[10px]` now stays 10, and a `h-[44px]` stays 44).
      // The sweep in the handoff report lists every such call site.
      data-cs
      className={clsx(
        (props.disabled || loading) && 'opacity-50 pointer-events-none',
        variant.frame,
        // Buffer labels every level at 14/500, on every button in the app
        'text-[14px] font-[500] cursor-pointer items-center justify-center flex relative outline-none focus-visible:ring-2 focus-visible:ring-forth',
        props?.className
      )}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ReactLoading
            type="spin"
            width={height! / 2}
            height={height! / 2}
          />
        </div>
      )}
      {/* the gap lives here, not on the button: the button's own children are
          this wrapper plus the absolutely-positioned spinner, so a gap on the
          button would separate nothing. Buffer's icon-to-label gap is 8 at 40px
          and 4 at 32px. */}
      <div
        className={clsx(
          innerClassName,
          variant.gap,
          'flex-1 items-center justify-center flex',
          loading && 'invisible'
        )}
      >
        {children}
      </div>
    </button>
  );
};
