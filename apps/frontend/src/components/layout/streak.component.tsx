'use client';

import { FC, useMemo } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';

export const StreakComponent: FC = () => {
  const user = useUser();

  const streakDays = useMemo(() => {
    if (!user?.streakSince) return 0;
    const streakStart = new Date(user.streakSince);
    const now = new Date();
    const diffTime = now.getTime() - streakStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays + 1 <= 0) {
      return 1;
    }

    return diffDays + 1;
  }, [user?.streakSince]);

  const tooltipContent = useMemo(() => {
    if (streakDays === 1) {
      return 'You started your streak today! Keep posting daily to maintain it.';
    }
    return `You're on a ${streakDays} day posting streak! Keep it going!`;
  }, [streakDays]);

  if (!user?.streakSince || streakDays <= 0) {
    return null;
  }

  // Buffer parity: outline plant glyph (24px, muted stroke) with a small
  // lavender circle badge overlapping its bottom-right holding the count.
  return (
    <div
      className="relative cursor-default text-textItemBlur hover:text-newTextColor transition-colors duration-150"
      data-tooltip-id="tooltip"
      data-tooltip-content={tooltipContent}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 20h10" />
        <path d="M10 20c5.5-2.5.8-6.4 3-10" />
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
      </svg>
      <span className="absolute -bottom-[4px] -end-[6px] min-w-[16px] h-[16px] px-[3px] rounded-full bg-[#e2d8ff] text-[10px] leading-none font-[600] text-black flex items-center justify-center">
        {streakDays}
      </span>
    </div>
  );
};
