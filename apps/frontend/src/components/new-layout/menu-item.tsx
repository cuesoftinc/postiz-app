'use client';
import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

export const MenuItem: FC<{ label: string; icon: ReactNode; path: string; onClick?: () => void }> = ({
  label,
  icon,
  path,
  onClick,
}) => {
  const currentPath = usePathname();
  const isActive = currentPath.indexOf(path) === 0;

  const className = clsx(
    'group w-full minCustom:h-[54px] custom:h-[44px] py-[8px] px-[6px] minCustom:gap-[4px] custom:gap-[2px] flex flex-col font-[600] items-center justify-center rounded-[12px] hover:text-textItemFocused hover:bg-boxFocused transition-colors',
    // as a bottom tab: share the row evenly and be allowed to shrink, so the
    // bar can never end up wider than the device. `relative` is what anchors
    // the active indicator below — without it the absolute pseudo-ish marker
    // resolves against the fixed bar and draws across all seven tabs.
    'phone:relative phone:flex-1 phone:w-auto phone:min-w-0 phone:h-[56px] phone:px-[2px] phone:py-[6px] phone:gap-[3px] phone:rounded-none',
    isActive ? 'text-textItemFocused bg-boxFocused' : 'text-textItemBlur',
    // The desktop active treatment is a filled white pill. At 56px tall and
    // full tab width that reads as a white slab across the bar, and the label
    // colour has to work on BOTH a white bar (light mode) and a dark one, so
    // neither #fff nor stock's dark text survives. Brand violet + a top
    // indicator instead.
    isActive && 'phone:bg-transparent phone:text-btnPrimary'
  );

  const inner = (
    <>
      {isActive && (
        <span
          aria-hidden
          className="hidden phone:block absolute top-0 start-[14px] end-[14px] h-[3px] rounded-b-[3px] bg-btnPrimary"
        />
      )}
      {/* Fixed box: the stock icons range from 19px to 23px tall, and in a
          fixed-height column with justify-center that pushed the taller items'
          labels down until they were clipped by the bar's edge. */}
      <div className="custom:scale-90 transition-transform phone:h-[22px] phone:flex phone:items-center phone:justify-center phone:shrink-0">
        {icon}
      </div>
      <div className="custom:text-[9px] minCustom:text-[10px] leading-[1.1] text-center phone:text-[9px] phone:w-full phone:truncate phone:shrink-0">
        {label}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} title={label} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      title={label}
      {...path.indexOf('http') === 0 && { target: '_blank' }}
      className={className}
    >
      {inner}
    </Link>
  );
};
