import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { clsx } from 'clsx';
import { useFormContext } from 'react-hook-form';
import { TranslatedLabel } from '../translation/translated-label';

export const CustomSelect: FC<{
  error?: any;
  disableForm?: boolean;
  label: string;
  name: string;
  placeholder?: string;
  removeError?: boolean;
  onChange?: () => void;
  className?: string;
  translationKey?: string;
  translationParams?: Record<string, string | number>;
  options: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
  }>;
}> = (props) => {
  const {
    options,
    onChange,
    placeholder,
    className,
    removeError,
    label,
    translationKey,
    translationParams,
    ...rest
  } = props;
  const form = useFormContext();
  const value = form.watch(props.name);
  const [isOpen, setIsOpen] = useState(false);
  const err = useMemo(() => {
    const split = (props.name + '.value').split('.');
    let errIn = form?.formState?.errors;
    for (let i = 0; i < split.length; i++) {
      // @ts-ignore
      errIn = errIn?.[split[i]];
    }
    return errIn?.message;
  }, [props.name, form]);
  const option = useMemo(() => {
    if (value?.value && options.length) {
      return (
        options.find((option) => option.value === value.value) || {
          label: placeholder,
          icon: false,
        }
      );
    }
    return {
      label: placeholder,
    };
  }, [value, options]);
  const changeOpen = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);
  const setOption = useCallback(
    (newOption: any) => (e: any) => {
      form.setValue(props.name, newOption);
      setIsOpen(false);
      e.stopPropagation();
    },
    []
  );
  useEffect(() => {
    if (onChange) {
      onChange();
    }
  }, [value]);
  return (
    <div className={clsx('flex flex-col gap-[6px] relative', className)}>
      {!!label && (
        <div className={`text-[13px] text-newTextColor/60`}>
          <TranslatedLabel
            label={label}
            translationKey={translationKey}
            translationParams={translationParams}
          />
        </div>
      )}
      <div
        className={clsx(
          'bg-newBgColorInner h-[36px] border-newTableBorder border rounded-[6px] text-newTextColor placeholder:text-newTextColor/50 items-center justify-center flex'
        )}
        onClick={changeOpen}
      >
        <div className="flex-1 ps-[16px] text-[14px] select-none flex gap-[8px]">
          {!!option.icon && (
            <div className="flex justify-center items-center">
              {option.icon}
            </div>
          )}

          {option.label}
        </div>
        <div className="pe-[16px] flex gap-[8px]">
          <div>
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
              className="text-newTextColor/60"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {!!value && (
            <div onClick={setOption(undefined)}>
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
                className="text-newTextColor/60"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </div>
          )}
        </div>
      </div>
      {isOpen && (
        <div
          className={clsx(
            label && !removeError && '-mt-[23px]',
            'z-[100] absolute w-full top-[100%] start-0 flex items-center rounded-bl-[6px] rounded-br-[6px] flex-col bg-newTableBorder gap-[1px] border-l border-r border-b border-newTableBorder overflow-hidden'
          )}
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={setOption(option)}
              className="px-[16px] py-[8px] bg-newBgColorInner w-full flex gap-[8px] hover:bg-boxHover select-none cursor-pointer"
            >
              {!!option.icon && (
                <div className="flex justify-center items-center">
                  {option.icon}
                </div>
              )}
              <div className="flex-1 text-[14px]">{option.label}</div>
            </div>
          ))}
        </div>
      )}
      {!removeError && (
        <div className="text-red-400 text-[12px]">
          {(err as any) || <>&nbsp;</>}
        </div>
      )}
    </div>
  );
};
