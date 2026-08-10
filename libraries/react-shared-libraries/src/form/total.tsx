import { FC, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { useFormContext } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const Total: FC<{
  name: string;
  customOnChange?: () => void;
}> = (props) => {
  const { name, customOnChange } = props;
  const form = useFormContext();
  const value = form.watch(props.name);
  const changeNumber = useCallback(
    (value: number) => () => {
      if (value === 0) {
        return;
      }
      form.setValue(name, value);
    },
    [value]
  );
  useEffect(() => {
    if (customOnChange) {
      customOnChange();
    }
  }, [value, customOnChange]);

  const t = useT();

  return (
    <div className="flex flex-col gap-[6px] relative w-[158px]">
      <div className={`text-[13px] text-newTextColor/60`}>{t('total', 'Total')}</div>
      <div
        className={clsx(
          'bg-newBgColorInner h-[36px] border-newTableBorder border rounded-[6px] text-newTextColor items-center justify-center flex'
        )}
      >
        <div className="flex-1 px-[16px] text-[14px] select-none flex gap-[8px] items-center">
          <div onClick={changeNumber(value - 1)}>
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
              className={value === 1 ? 'text-newTextColor/40' : undefined}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
            </svg>
          </div>
          <div className="flex-1 text-newTextColor text-[14px] text-center">
            {value}
          </div>
          <div onClick={changeNumber(value + 1)}>
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
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
