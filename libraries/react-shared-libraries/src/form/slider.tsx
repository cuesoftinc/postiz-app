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
  return (
    <div
      className={clsx(
        'w-[57px] h-[34px] p-[4px] border-newTableBorder border rounded-[100px]',
        value === 'on' && fill && 'bg-btnPrimary'
      )}
      onClick={change}
    >
      <div className="w-full h-full relative rounded-[100px]">
        <div
          className={clsx(
            // knob sits INSET in the pill (track height minus ~6px, centered)
            // — at full track height it read as bulging past the pill edges
            'absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] rounded-full transition-all cursor-pointer',
            value === 'on' && fill ? 'bg-black' : 'bg-customColor5',
            value === 'on' ? 'left-[100%] -translate-x-[100%]' : 'left-0'
          )}
        />
      </div>
    </div>
  );
};
