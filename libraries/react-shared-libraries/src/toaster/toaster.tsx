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
  return (
    <div
      className={clsx(
        'animate-fadeDown rounded-[8px] gap-[18px] flex items-center overflow-hidden bg-customColor8 p-[16px] min-w-[319px] fixed start-[50%] text-white z-[900] top-[32px] -translate-x-[50%] h-[56px]',
        toasterType === 'success' ? 'shadow-greenToast' : 'shadow-yellowToast'
      )}
    >
      <div>
        {toasterType === 'success' ? (
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
            className="text-[#6CE9A6]"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        ) : (
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
            className="text-[#FEC84B]"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        )}
      </div>
      <div className="flex-1 text-newTextColor">{toasterText}</div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="60"
        height="56"
        viewBox="0 0 60 56"
        fill="none"
        className="absolute top-0 start-0"
      >
        <g filter="url(#filter0_f_376_2968)">
          <ellipse
            cx="-12"
            cy="28"
            rx="28"
            ry="13"
            fill={toasterType === 'success' ? '#6CE9A6' : '#FEC84B'}
          />
        </g>
        <defs>
          <filter
            id="filter0_f_376_2968"
            x="-84"
            y="-29"
            width="144"
            height="114"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feGaussianBlur
              stdDeviation="22"
              result="effect1_foregroundBlur_376_2968"
            />
          </filter>
        </defs>
      </svg>
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
