'use client';

import { FC, useCallback } from 'react';

export const Bullets: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const bullet = () => {
    editor?.commands?.toggleBulletList();
  };
  return (
    <div
      data-tooltip-id="tooltip"
      data-tooltip-content="Bullets"
      onClick={bullet}
      className="select-none cursor-pointer rounded-[6px] w-[30px] h-[30px] bg-newColColor flex justify-center items-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
        <path d="M3 6h.01" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M8 6h13" />
      </svg>
    </div>
  );
};
