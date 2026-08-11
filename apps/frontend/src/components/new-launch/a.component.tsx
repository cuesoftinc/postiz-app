'use client';

import { FC, useCallback } from 'react';

export const AComponent: FC<{
  editor: any;
  currentValue: string;
}> = ({ editor }) => {
  const mark = () => {
    const previousUrl = editor?.getAttributes('link')?.href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor?.chain()?.focus()?.extendMarkRange('link')?.unsetLink()?.run();

      return;
    }

    // update link
    try {
      editor
        ?.chain()
        ?.focus()
        ?.extendMarkRange('link')
        ?.setLink({ href: url })
        ?.run();
    } catch (e) {}
    editor?.commands?.focus();
  };
  return (
    <div
      data-tooltip-id="tooltip"
      data-tooltip-content="Link"
      onClick={mark}
      className="select-none cursor-pointer rounded-[8px] w-[32px] h-[32px] phone:w-[40px] phone:h-[40px] border border-newTableBorder hover:bg-newTableHeader flex justify-center items-center"
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
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </div>
  );
};
