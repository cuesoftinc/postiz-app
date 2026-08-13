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
        {/* The glyph sits on the TRACK, opposite the knob, which is Buffer's
            actual arrangement (measured 2026-08-13: 43x24 track, 12x12 glyph,
            plain knob). It was previously nested inside the knob, which is not
            what Buffer does and left the 20px knob carrying a 12px mark.
            COLOUR IS BRAND-MAPPED, NOT COPIED. Buffer's on-track is a dark
            green (#4e975b) so its glyph is WHITE; ours is lime (#bfff72), a
            light field, where white would be invisible. The fork's own rule
            covers this: anything painted with lime takes black ink. Here that
            happens for free rather than by an explicit hex, because the track
            carries bg-btnPrimary and global.scss's
            `[class*="bg-btnPrimary"] svg { color: #000 !important }` forces
            currentColor black on any svg inside it.
            Buffer also marks the OFF state, with an x where the check would be.
            We rendered nothing at all there, so an off switch and a disabled
            one looked identical. */}
        {fill && (
          <div
            className={clsx(
              'absolute top-1/2 -translate-y-1/2 w-[12px] h-[12px] flex items-center justify-center pointer-events-none transition-all',
              // opposite the knob: check on the left when on, x on the right
              // when off, so the mark always occupies the vacated half
              value === 'on'
                ? 'left-[4px] text-black'
                : 'right-[4px] text-newTextColor/40'
            )}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {value === 'on' ? (
                <path d="M20 6 9 17l-5-5" />
              ) : (
                <path d="M18 6 6 18M6 6l12 12" />
              )}
            </svg>
          </div>
        )}
        <div
          className={clsx(
            // knob sits INSET in the pill (track height minus the 2px padding
            // either side); at full track height it read as bulging past the
            // pill edges
            'absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] rounded-full transition-all cursor-pointer',
            // white knob against the lime track, matching Buffer's pairing
            isToggle ? 'bg-white' : 'bg-customColor5',
            value === 'on' ? 'left-[100%] -translate-x-[100%]' : 'left-0'
          )}
        />
      </div>
    </div>
  );
};
