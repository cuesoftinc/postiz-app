'use client';

import { FC } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';

/**
 * The account-avatar + platform-badge cluster that channel lists all over the
 * app re-implement (16 sites surveyed). It exists here for the same reason as
 * side-panel.ts: the copies had already drifted apart. In particular:
 *
 *  - Only launches' MenuComponent (and a few of the Create Post satellites)
 *    give YouTube its dedicated `/icons/platforms/youtube.svg` badge; agents,
 *    analytics and plugs silently fell back to the generic youtube.png. The
 *    svg treatment is the design — it wins everywhere this component renders.
 *  - The choice between ImageWithFallback (swaps to a fallback image onError)
 *    and a bare SafeImage was made ad hoc per site. Here the avatar is always
 *    ImageWithFallback and the `fallback` prop picks the policy; the badge is
 *    always SafeImage (a platform icon that 404s has nothing to fall back to).
 *
 * Geometry is deliberately NOT normalized: per-context sizes (calendar's 32/20
 * density, the preview page's 50/30, the modal pickers' 42/16 …) are design,
 * so every number is a prop and only the defaults encode the side-panel row.
 */
export interface ChannelAvatarProps {
  /** Account avatar URL. When empty the resolved fallback renders instead. */
  picture?: string;
  /** Platform identifier, e.g. 'youtube' — also names the badge icon. */
  identifier: string;
  /** Accessible name for the avatar img; falls back to the identifier. */
  name?: string;
  /** Avatar width/height in px (HTML attributes, not classes). Default 36. */
  size?: number;
  /** Platform badge width/height in px. Default 18.41 (the side-panel row). */
  badgeSize?: number;
  /** 'rounded' = rounded-[8px] (default), 'round' = rounded-full. */
  shape?: 'rounded' | 'round';
  /**
   * Position classes for the badge, relative to the avatar box.
   * Default 'bottom-[5px] -end-[5px]' (the side-panel row).
   */
  badgeOffset?: string;
  /**
   * Fallback policy for the avatar image:
   *  - 'platform'    → /icons/platforms/<identifier>.png (agents/analytics/plugs)
   *  - 'placeholder' → /no-picture.jpg                   (launches)
   *  - any other string is used verbatim as the fallback src
   *    (third-party passes its own /icons/third-party/<id>.png).
   */
  fallback?: 'platform' | 'placeholder' | (string & {});
  /** Render the platform badge. Default true; third-party icons have none. */
  showBadge?: boolean;
  /** opacity-50 on the whole cluster. Default false. NOTE: ChannelRow applies
   *  the disabled opacity itself (on a wrapper that includes the hover accent),
   *  so rows must NOT also set this — the two would compound to 25%. */
  disabled?: boolean;
  /**
   * YouTube svg badge width. The canonical row renders the svg at 20px next to
   * an 18.41px png badge, so at the default badgeSize this defaults to 20;
   * any custom badgeSize is used as-is (the satellites shrink both together).
   */
  youtubeBadgeSize?: number;
  /** Position classes for the youtube svg when it differs from badgeOffset
   *  (select.current nudges it to bottom-[2px] end-[2px]). */
  youtubeBadgeOffset?: string;
  /** Skin classes for the png badge. Defaults to
   *  'rounded-[8px] border border-fifth'; pass e.g. 'rounded-full border
   *  border-fifth' to reproduce a satellite's round badge. */
  badgeClassName?: string;
  /** Extra classes on the avatar img itself (launches adds
   *  'min-w-[36px] min-h-[36px]' so the flex row can never squash it). */
  className?: string;
}

const DEFAULT_BADGE_SIZE = 18.41;

export const ChannelAvatar: FC<ChannelAvatarProps> = (props) => {
  const {
    picture,
    identifier,
    name,
    size = 36,
    badgeSize = DEFAULT_BADGE_SIZE,
    shape = 'rounded',
    badgeOffset = 'bottom-[5px] -end-[5px]',
    fallback = 'platform',
    showBadge = true,
    disabled = false,
    youtubeBadgeSize,
    youtubeBadgeOffset,
    badgeClassName,
    className,
  } = props;

  const fallbackSrc =
    fallback === 'platform'
      ? `/icons/platforms/${identifier}.png`
      : fallback === 'placeholder'
      ? '/no-picture.jpg'
      : fallback;

  const youtubeSize =
    youtubeBadgeSize ?? (badgeSize === DEFAULT_BADGE_SIZE ? 20 : badgeSize);

  return (
    // `flex` so the img is a flex item and the wrapper shrink-wraps it exactly
    // (an inline img would leave descender space below and shift the badge).
    <div className={clsx('relative flex', disabled && 'opacity-50')}>
      <ImageWithFallback
        fallbackSrc={fallbackSrc}
        src={picture || fallbackSrc}
        className={clsx(
          shape === 'round' ? 'rounded-full' : 'rounded-[8px]',
          className
        )}
        alt={name || identifier}
        width={size}
        height={size}
      />
      {showBadge &&
        (identifier === 'youtube' ? (
          // The dedicated youtube badge: an svg with its own silhouette — no
          // border, no rounding, and slightly larger than the png badges.
          <img
            src="/icons/platforms/youtube.svg"
            className={clsx('absolute z-10', youtubeBadgeOffset ?? badgeOffset)}
            width={youtubeSize}
            alt={identifier}
          />
        ) : (
          <SafeImage
            src={`/icons/platforms/${identifier}.png`}
            className={clsx(
              'absolute z-10',
              badgeOffset,
              badgeClassName ?? 'rounded-[8px] border border-fifth'
            )}
            alt={identifier}
            width={badgeSize}
            height={badgeSize}
          />
        ))}
    </div>
  );
};
