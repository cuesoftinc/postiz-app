'use client';

import { FC, useCallback } from 'react';
import clsx from 'clsx';
export const Slider: FC<{
  value: 'on' | 'off';
  fill?: boolean;
  onChange: (value: 'on' | 'off') => void;
}> = (props) => {
  const { value, onChange, fill } = props;
  const change = useCallback(() => {
    onChange(value === 'on' ? 'off' : 'on');
  }, [value]);
  // Buffer's measured toggle is 43x24 with a check glyph in the knob when on.
  // This component shipped at 57x34 while the settings-notifications skeleton
  // already reserved a Buffer-sized 24px pill, so the measurement had reached
  // the placeholder and never the control. Neither 57 nor 34 is on the
  // global.scss size ladder, so the divergence was real rather than a ladder
  // artefact, and none of the values below are on it either, so no data-cs.
  // 43 - 2*2 padding - 20 knob leaves 19px of travel.
  const isToggle = value === 'on' && fill;
  return (
    <div
      className={clsx(
        // shrink-0: the toggle is a fixed-size control — inside justify-between
        // rows the longest label was crushing its siblings' pills to ~42px
        'w-[43px] h-[24px] p-[2px] border-newTableBorder border rounded-[100px] shrink-0',
        isToggle && 'bg-btnPrimary'
      )}
      onClick={change}
    >
      <div className="w-full h-full relative rounded-[100px]">
        <div
          className={clsx(
            // knob sits INSET in the pill (track height minus the 2px padding
            // either side); at full track height it read as bulging past the
            // pill edges
            'absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] rounded-full transition-all cursor-pointer flex items-center justify-center',
            // knob goes WHITE in the on state (Buffer's pairing: green track,
            // white knob); the old black knob left the new glyph nowhere
            // legible to sit inside a lime track
            isToggle ? 'bg-white' : 'bg-customColor5',
            value === 'on' ? 'left-[100%] -translate-x-[100%]' : 'left-0'
          )}
        >
          {/* Glyph follows `fill`, not `value`, because `fill` is what marks a
              real on/off switch: the one fill-less consumer (billing
              monthly/yearly) is a two-way selector where a confirmation check
              would misread.
              stroke is an explicit hex, NOT currentColor: this svg is a
              descendant of the lime track, and global.scss's
              `[class*="bg-btnPrimary"] svg { color: #000 !important }` outranks
              any class we could put here, so currentColor would be forced
              black regardless. Black is what we want on the white knob anyway
              (same "lime is a light field, so it takes black ink" rule), and
              setting stroke directly makes that deterministic instead of
              dependent on a global rule. Path matches the fork's other check. */}
          {isToggle && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
