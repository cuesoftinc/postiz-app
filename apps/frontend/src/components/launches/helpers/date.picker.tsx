import { FC, useCallback, useState } from 'react';
import dayjs from 'dayjs';
import { Calendar, TimeInput } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import { Button } from '@gitroom/react/form/button';
import { isUSCitizen } from './isuscitizen.utils';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { CalendarIcon } from '@gitroom/frontend/components/ui/icons';
export const DatePicker: FC<{
  date: dayjs.Dayjs;
  onChange: (day: dayjs.Dayjs) => void;
}> = (props) => {
  const { date, onChange } = props;
  const [open, setOpen] = useState(false);
  const t = useT();

  const changeShow = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);
  const ref = useClickOutside<HTMLDivElement>(() => {
    setOpen(false);
  });
  const changeDate = useCallback(
    (type: 'date' | 'time') => (day: Date) => {
      onChange(
        newDayjs(
          type === 'time'
            ? date.format('YYYY-MM-DD') + ' ' + newDayjs(day).format('HH:mm:ss')
            : newDayjs(day).format('YYYY-MM-DD') + ' ' + date.format('HH:mm:ss')
        )
      );
    },
    [date]
  );
  return (
    <div
      className="px-[16px] phone:px-[10px] border border-newTextColor/10 rounded-[8px] justify-center flex gap-[8px] items-center relative h-[44px] text-[15px] phone:text-[13px] font-[550] select-none flex-1 whitespace-nowrap"
      onClick={changeShow}
      ref={ref}
    >
      <div className="cursor-pointer">
        <CalendarIcon />
      </div>
      <div className="cursor-pointer">
        {date.format(isUSCitizen() ? 'MM/DD/YYYY hh:mm A' : 'DD/MM/YYYY HH:mm')}
      </div>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          // phone: the popover re-roots to the VIEWPORT (fixed; no ancestor
          // carries a transform, verified) instead of centering on the
          // trigger: the composer footer wraps the split control to the
          // start edge at 390 and half the ~326px panel ran past the left
          // viewport edge. Fixed + the same start-50%/-translate-x-50% pair
          // now centers it in the screen; bottom-16 floats it above the
          // footer, and the max sizes keep it inside small viewports.
          className="animate-fadeIn absolute phone:fixed bottom-[100%] phone:bottom-[16px] mb-[16px] phone:mb-0 start-[50%] -translate-x-[50%] phone:max-w-[calc(100vw-16px)] phone:max-h-[calc(100dvh-32px)] phone:overflow-y-auto bg-newBgColorInner border border-newTableBorder text-newTextColor rounded-[16px] shadow-menu z-[300] p-[16px] flex flex-col"
        >
          <Calendar
            onChange={changeDate('date')}
            value={date.toDate()}
            dayClassName={(date, modifiers) => {
              if (modifiers.outside) {
                return '!text-gray';
              }
              if (modifiers.selected) {
                return '!bg-boxFocused !text-textItemFocused !outline-none';
              }
              if (modifiers.weekend) {
                return '!text-textItemBlur';
              }
              return '!text-newTextColor';
            }}
            classNames={{
              day: 'hover:bg-boxHover rounded-[6px]',
              calendarHeaderControl: 'text-newTextColor hover:bg-boxHover',
              calendarHeaderLevel: 'text-newTextColor hover:bg-boxHover', // cell: 'child:!text-newTextColor'
            }}
          />
          <TimeInput
            onChange={changeDate('time')}
            label="Pick time"
            classNames={{
              label: 'text-[13px] text-newTextColor/60 py-[12px]',
              input:
                'bg-transparent h-[36px] border border-newTableBorder text-newTextColor rounded-[6px] outline-none focus:border-forth',
            }}
            defaultValue={date.toDate()}
          />
          <Button className="mt-[12px]" onClick={changeShow}>
            {t('close', 'Close')}
          </Button>
        </div>
      )}
    </div>
  );
};
