'use client';

import { FC, useCallback } from 'react';

export const HeadingComponent: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const setHeading = (level: number) => () => {
    editor?.commands?.unsetUnderline();
    editor?.commands?.unsetBold();
    editor?.commands?.toggleHeading({ level });
  };

  return (
    <div className="select-none cursor-pointer rounded-[8px] w-[32px] h-[32px] phone:w-[40px] phone:h-[40px] border border-newTableBorder hover:bg-newTableHeader flex justify-center items-center group relative">
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
        <path d="M6 12h12" />
        <path d="M6 20V4" />
        <path d="M18 20V4" />
      </svg>
      <div
        data-tooltip-id="tooltip"
        data-tooltip-content="Title"
        className="flex p-[10px] gap-[5px] -left-[50%] rounded-[8px] bottom-[100%] opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 bg-newBgColorInner border border-newTableBorder shadow-menu z-[100] absolute transition-all"
      >
        <div onClick={setHeading(1)}>
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
            <path d="M4 12h8" />
            <path d="M4 18V6" />
            <path d="M12 18V6" />
            <path d="m17 12 3-2v8" />
          </svg>
        </div>
        <div onClick={setHeading(2)}>
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
            <path d="M4 12h8" />
            <path d="M4 18V6" />
            <path d="M12 18V6" />
            <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
          </svg>
        </div>
        <div onClick={setHeading(3)}>
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
            <path d="M4 12h8" />
            <path d="M4 18V6" />
            <path d="M12 18V6" />
            <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
            <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
          </svg>
        </div>
      </div>
    </div>
  );
};
