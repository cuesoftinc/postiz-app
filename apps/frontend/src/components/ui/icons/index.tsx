import React, { FC, SVGProps, useEffect } from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import { modeEmitter } from '@gitroom/frontend/components/layout/mode.component';

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Settings/Gear Icon
export const SettingsIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Chevron Down Icon (rotatable)
export const ChevronDownIcon: FC<IconProps & { rotated?: boolean }> = ({
  size = 20,
  className,
  rotated,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx(rotated && 'rotate-180', 'transition-transform', className)}
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Chevron Up Icon
export const ChevronUpIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);

// Close/X Icon
export const CloseIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

// Small Close Icon
export const CloseIconSmall: FC<IconProps> = ({
  size = 10,
  className,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

// Trash/Delete Icon
export const TrashIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

export const DelayIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

// Dropdown Arrow (filled triangle)
export const DropdownArrowIcon: FC<IconProps & { rotated?: boolean }> = ({
  size = 20,
  className,
  rotated,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx(rotated && 'rotate-180', 'transition-transform', className)}
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Small Dropdown Arrow
export const DropdownArrowSmallIcon: FC<IconProps & { rotated?: boolean }> = ({
  className,
  rotated,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx(rotated && 'rotate-180', 'transition-transform', className)}
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Calendar Icon
export const CalendarIcon: FC<IconProps> = ({ className, ...props }) => (
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
    className={className}
    {...props}
  >
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

// Repeat/Cycle Icon
export const RepeatIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

// Tag Icon
export const TagIcon: FC<IconProps> = ({ className, ...props }) => (
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
    className={className}
    {...props}
  >
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
  </svg>
);

// Plus Icon
export const PlusIcon: FC<IconProps> = ({ size = 16, className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

// Checkmark Icon
export const CheckmarkIcon: FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// Global/Planet Icon
export const GlobalIcon: FC<IconProps> = ({
  size = 20,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

// User Icon
export const UserIcon: FC<IconProps> = ({ size = 20, className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// Expand Icon
export const ExpandIcon: FC<IconProps> = ({
  size = 24,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M15 3h6v6" />
    <path d="m21 3-7 7" />
    <path d="m3 21 7-7" />
    <path d="M9 21H3v-6" />
  </svg>
);

// Collapse Icon
export const CollapseIcon: FC<IconProps> = ({
  size = 24,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="m14 10 7-7" />
    <path d="M20 10h-6V4" />
    <path d="m3 21 7-7" />
    <path d="M4 14h6v6" />
  </svg>
);

// Lock Icon
export const LockIcon: FC<IconProps> = ({ size = 32, className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// Connection Line Icon (for thread/comment indication)
export const ConnectionLineIcon: FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="87"
    viewBox="0 0 18 87"
    fill="none"
    className={className}
    {...props}
  >
    <path
      d="M0.75 0.75V79.75C0.75 83.0637 3.43629 85.75 6.75 85.75H16.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// Reset/Back to Global Icon
export const ResetIcon: FC<IconProps> = ({
  size = 16,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

// Emoji Icon
export const EmojiIcon: FC<IconProps> = ({
  size = 16,
  className,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
  </svg>
);

// Chevron Left Icon
export const ChevronLeftIcon: FC<IconProps> = ({
  size = 24,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

// Chevron Right Icon
export const ChevronRightIcon: FC<IconProps> = ({
  size = 24,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

// Delete Circle Icon (for media delete)
export const DeleteCircleIcon: FC<IconProps> = ({
  size = 18,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx('text-[#FF3F3F]', className)}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

// Close Circle Icon (smaller, for clearing media)
export const CloseCircleIcon: FC<IconProps> = ({
  size = 15,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx('text-[#FF3F3F]', className)}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

// Drag Handle Icon
export const DragHandleIcon: FC<IconProps> = ({
  size = 15,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

// Media Settings Icon (gear for media)
export const MediaSettingsIcon: FC<IconProps> = ({
  size = 40,
  className,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Insert Media Icon
export const InsertMediaIcon: FC<IconProps> = ({
  size = 16,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M16 5h6" />
    <path d="M19 2v6" />
    <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    <circle cx="9" cy="9" r="2" />
  </svg>
);

// Design Media Icon (pencil/edit)
export const DesignMediaIcon: FC<IconProps> = ({
  size = 16,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
  </svg>
);

// Vertical Divider Icon
export const VerticalDividerIcon: FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="2"
    height="17"
    viewBox="0 0 2 17"
    fill="none"
    className={className}
    {...props}
  >
    <path
      d="M0.75 0.75V16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const NoMediaIcon: FC = () => {
  const [mode, setMode] = useCookie('mode', 'dark');

  useEffect(() => {
    modeEmitter.on('mode', (value) => {
      setMode(value);
    });

    return () => {
      modeEmitter.removeAllListeners();
    };
  }, []);

  return (
    <>
      {mode === 'light' ? (
        <svg
          width="192"
          height="151"
          viewBox="0 0 192 151"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M109.75 59.0141C104.489 59.0141 113.46 -5.73557 91.0289 1.57563C69.7021 8.5269 99.5229 59.0141 94.5119 59.0141C89.5009 59.0141 54.4775 56.107 52.1458 71.9377C49.5418 89.6178 95.4225 79.7216 96.7894 81.9895C98.1563 84.2573 78.775 111.109 91.0289 119.324C103.724 127.835 119.934 96.3491 122.711 96.3491C125.489 96.3491 139.845 147.93 151.514 133.684C160.997 122.106 138.391 96.3491 142.873 96.3491C147.355 96.3491 180.793 98.9658 186.076 81.9895C192.534 61.2424 134.828 76.0575 131.352 71.9377C127.876 67.818 159.167 34.7484 142.873 25.987C126.785 17.3361 115.012 59.0141 109.75 59.0141Z"
            stroke="#DACBFB"
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="22.6328"
            y="62.543"
            width="49.2079"
            height="49.2079"
            rx="12.6792"
            transform="rotate(-16.275 22.6328 62.543)"
            fill="#E7DDFE"
          />
          <path
            d="M66.8612 81.5418L60.5419 73.8544C59.3886 72.4461 58.1025 71.8318 56.9211 72.1115C55.7516 72.3877 54.8703 73.5173 54.4666 75.3019L53.3809 80.0591C53.1531 81.0631 52.6197 81.7787 51.8933 82.0558C51.1583 82.3485 50.2868 82.1731 49.4472 81.5718L49.0852 81.3128C47.9215 80.4935 46.715 80.2857 45.6666 80.7089C44.6181 81.1321 43.9113 82.1457 43.653 83.5362L42.7853 88.2819C42.4791 89.9989 43.0589 91.7178 44.3481 92.8781C45.6373 94.0384 47.4099 94.4456 49.0778 93.9588L64.3891 89.4902C65.997 89.0209 67.2623 87.7792 67.758 86.1761C68.2777 84.566 67.9279 82.8321 66.8612 81.5418Z"
            fill="white"
          />
          <path
            d="M45.8451 76.6857C48.085 76.032 49.3709 73.6862 48.7172 71.4462C48.0634 69.2063 45.7176 67.9204 43.4777 68.5741C41.2377 69.2279 39.9518 71.5737 40.6056 73.8136C41.2593 76.0536 43.6051 77.3395 45.8451 76.6857Z"
            fill="white"
          />
          <rect
            x="64.8105"
            y="70.6133"
            width="66.3578"
            height="66.3578"
            rx="18.1132"
            fill="#DACBFB"
          />
          <path
            d="M80.1222 117.087L80.0843 117.125C79.5723 116.006 79.2499 114.735 79.1172 113.332C79.2499 114.716 79.6102 115.968 80.1222 117.087Z"
            fill="white"
          />
          <path
            d="M92.2983 100.718C94.7909 100.718 96.8115 98.6972 96.8115 96.2046C96.8115 93.712 94.7909 91.6914 92.2983 91.6914C89.8058 91.6914 87.7852 93.712 87.7852 96.2046C87.7852 98.6972 89.8058 100.718 92.2983 100.718Z"
            fill="white"
          />
          <path
            d="M105.932 84.8281H90.0409C83.1384 84.8281 79.0234 88.9431 79.0234 95.8456V111.737C79.0234 113.804 79.3837 115.605 80.0854 117.122C81.7162 120.725 85.2054 122.754 90.0409 122.754H105.932C112.834 122.754 116.949 118.639 116.949 111.737V107.394V95.8456C116.949 88.9431 112.834 84.8281 105.932 84.8281ZM113.858 104.739C112.379 103.469 109.99 103.469 108.511 104.739L100.622 111.509C99.1431 112.78 96.7538 112.78 95.2747 111.509L94.63 110.978C93.2836 109.802 91.1408 109.689 89.6237 110.713L82.5316 115.472C82.1144 114.41 81.8679 113.178 81.8679 111.737V95.8456C81.8679 90.4981 84.6934 87.6726 90.0409 87.6726H105.932C111.279 87.6726 114.105 90.4981 114.105 95.8456V104.948L113.858 104.739Z"
            fill="white"
          />
        </svg>
      ) : (
        <svg
          width="192"
          height="151"
          viewBox="0 0 192 151"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M109.75 59.0141C104.489 59.0141 113.46 -5.73557 91.0289 1.57563C69.7021 8.5269 99.5229 59.0141 94.5119 59.0141C89.5009 59.0141 54.4775 56.107 52.1458 71.9377C49.5418 89.6178 95.4225 79.7216 96.7894 81.9895C98.1563 84.2573 78.775 111.109 91.0289 119.324C103.724 127.835 119.934 96.3491 122.711 96.3491C125.489 96.3491 139.845 147.93 151.514 133.684C160.997 122.106 138.391 96.3491 142.873 96.3491C147.355 96.3491 180.793 98.9658 186.076 81.9895C192.534 61.2424 134.828 76.0575 131.352 71.9377C127.876 67.818 159.167 34.7484 142.873 25.987C126.785 17.3361 115.012 59.0141 109.75 59.0141Z"
            stroke="white"
            strokeOpacity="0.08"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="22.6328"
            y="62.541"
            width="49.2079"
            height="49.2079"
            rx="12.6792"
            transform="rotate(-16.275 22.6328 62.541)"
            fill="#232222"
          />
          <path
            d="M66.8573 81.5379L60.538 73.8505C59.3847 72.4421 58.0986 71.8279 56.9172 72.1076C55.7477 72.3838 54.8664 73.5134 54.4627 75.298L53.377 80.0552C53.1492 81.0592 52.6158 81.7748 51.8894 82.0519C51.1544 82.3446 50.2829 82.1692 49.4433 81.5678L49.0813 81.3089C47.9176 80.4896 46.7111 80.2818 45.6626 80.705C44.6142 81.1282 43.9074 82.1418 43.6491 83.5323L42.7814 88.278C42.4752 89.995 43.055 91.7139 44.3442 92.8742C45.6334 94.0345 47.406 94.4417 49.0739 93.9549L64.3851 89.4863C65.9931 89.017 67.2584 87.7753 67.7541 86.1722C68.2738 84.5621 67.924 82.8282 66.8573 81.5379Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M45.8412 76.6818C48.0811 76.0281 49.367 73.6823 48.7133 71.4423C48.0595 69.2024 45.7137 67.9165 43.4738 68.5702C41.2338 69.2239 39.9479 71.5697 40.6017 73.8097C41.2554 76.0497 43.6012 77.3355 45.8412 76.6818Z"
            fill="white"
            fillOpacity="0.4"
          />
          <rect
            x="64.8125"
            y="70.6133"
            width="66.3578"
            height="66.3578"
            rx="18.1132"
            fill="#2C2B2B"
          />
          <path
            d="M80.1261 117.087L80.0882 117.125C79.5762 116.006 79.2538 114.735 79.1211 113.332C79.2538 114.716 79.6141 115.968 80.1261 117.087Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M92.3022 100.72C94.7948 100.72 96.8154 98.6991 96.8154 96.2065C96.8154 93.714 94.7948 91.6934 92.3022 91.6934C89.8097 91.6934 87.7891 93.714 87.7891 96.2065C87.7891 98.6991 89.8097 100.72 92.3022 100.72Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M105.936 84.8301H90.0448C83.1423 84.8301 79.0273 88.945 79.0273 95.8476V111.739C79.0273 113.805 79.3876 115.607 80.0893 117.124C81.7201 120.727 85.2093 122.756 90.0448 122.756H105.936C112.838 122.756 116.953 118.641 116.953 111.739V107.396V95.8476C116.953 88.945 112.838 84.8301 105.936 84.8301ZM113.862 104.741C112.383 103.471 109.994 103.471 108.515 104.741L100.626 111.511C99.147 112.781 96.7577 112.781 95.2786 111.511L94.6339 110.98C93.2875 109.804 91.1447 109.691 89.6276 110.715L82.5355 115.474C82.1183 114.412 81.8718 113.18 81.8718 111.739V95.8476C81.8718 90.5 84.6973 87.6745 90.0448 87.6745H105.936C111.283 87.6745 114.109 90.5 114.109 95.8476V104.95L113.862 104.741Z"
            fill="white"
            fillOpacity="0.4"
          />
        </svg>
      )}
    </>
  );
};
