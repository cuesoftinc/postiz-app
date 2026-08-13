'use client';

import { useCallback, useEffect, useState } from 'react';
import EventEmitter from 'events';
import clsx from 'clsx';
const toaster = new EventEmitter();
export const Toaster = () => {
  const [showToaster, setShowToaster] = useState(false);
  const [toasterText, setToasterText] = useState('');
  const [toasterType, setToasterType] = useState<'success' | 'warning' | ''>(
    ''
  );
  useEffect(() => {
    toaster.on(
      'show',
      (params: { text: string; type?: 'success' | 'warning' }) => {
        const { text, type } = params;
        setToasterText(text);
        setToasterType(type || 'success');
        setShowToaster(true);
        setTimeout(() => {
          setShowToaster(false);
        }, 4200);
      }
    );
    return () => {
      toaster.removeAllListeners();
    };
  }, []);
  if (!showToaster) {
    return <></>;
  }
  // Buffer toast surface (measured): #f6f6f4 on a 1px #e6e5e2 hairline, r12,
  // 20px icon slot, 14px ink body, soft shadow. The exact hexes are kept for
  // LIGHT: bg-newTableHeader (#f4f3f0) is close but NOT equal, and the border
  // token is an alpha, so neither token matches the measurement. Positioning
  // (top-center fixed) and the 4200ms timing are ours and stay; the old
  // dark card + blurred glow ellipse are retired.
  //
  // The pinned hexes MUST be light-scoped. Pinned unconditionally they left the
  // body copy (theme-dependent --new-textColor = white in dark) on a light
  // surface, so every toast in the default dark theme was invisible. The fork's
  // rule for a measured Buffer light value is "apply it light-only, dark keeps
  // its tokens" (colors.scss r1/r2 "dark mode untouched"; the .light-scoped
  // #cs-datetime / #cs-composer hover rules in global.scss), so the SURFACE
  // becomes theme-aware rather than the already-correct text being pinned to
  // match it. dark:border also replaces the black-alpha shadow as the edge on a
  // dark surface, the same fixup .dropdown-menu carries in its `.dark &` rule.
  return (
    <div
      className={clsx(
        'animate-fadeDown rounded-[12px] gap-[12px] flex items-center bg-[#f6f6f4] dark:bg-newBgColorInner border border-[#e6e5e2] dark:border-newTableBorder shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-[16px] min-w-[319px] fixed start-[50%] z-[900] top-[32px] -translate-x-[50%] h-[56px]'
      )}
    >
      <div className="w-[20px] h-[20px] min-w-[20px] flex items-center justify-center">
        {toasterType === 'success' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#16a34a]"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#d97706]"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        )}
      </div>
      <div className="flex-1 text-[14px] text-newTextColor">{toasterText}</div>
    </div>
  );
};
export const useToaster = () => {
  return {
    show: useCallback((text: string, type?: 'success' | 'warning') => {
      toaster.emit('show', {
        text,
        type,
      });
    }, []),
  };
};
