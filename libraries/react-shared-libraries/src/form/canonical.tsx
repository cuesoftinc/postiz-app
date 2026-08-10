'use client';

import React, {
  DetailedHTMLProps,
  FC,
  InputHTMLAttributes,
  useCallback,
  useMemo,
} from 'react';
import { clsx } from 'clsx';
import { useFormContext } from 'react-hook-form';
import dayjs from 'dayjs';
import { useShowPostSelector } from '../../../../apps/frontend/src/components/post-url-selector/post.url.selector';
import { TranslatedLabel } from '../translation/translated-label';

export const Canonical: FC<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & {
    error?: any;
    date: dayjs.Dayjs;
    disableForm?: boolean;
    label: string;
    name: string;
    translationKey?: string;
    translationParams?: Record<string, string | number>;
  }
> = (props) => {
  const {
    label,
    date,
    className,
    disableForm,
    error,
    translationKey,
    translationParams,
    ...rest
  } = props;
  const form = useFormContext();
  const err = useMemo(() => {
    if (error) return error;
    if (!form || !form.formState.errors[props?.name!]) return;
    return form?.formState?.errors?.[props?.name!]?.message! as string;
  }, [form?.formState?.errors?.[props?.name!]?.message, error]);
  const postSelector = useShowPostSelector(date);
  const onPostSelector = useCallback(async () => {
    const id = await postSelector();
    if (disableForm) {
      // @ts-ignore
      return rest.onChange({
        // @ts-ignore
        target: {
          value: id,
          name: props.name,
        },
      });
    }
    return form.setValue(props.name, id);
  }, [form]);
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-[3px]">
        <div className={`text-[13px] text-newTextColor/60`}>
          <TranslatedLabel
            label={label}
            translationKey={translationKey}
            translationParams={translationParams}
          />
        </div>
        <div>
          <svg
            onClick={onPostSelector}
            className="cursor-pointer text-newTextColor"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
          </svg>
        </div>
      </div>
      <input
        {...(disableForm ? {} : form.register(props.name))}
        className={clsx(
          'bg-newBgColorInner h-[36px] px-[16px] outline-none border-newTableBorder border rounded-[6px] text-textColor placeholder-textColor focus:border-forth',
          className
        )}
        {...rest}
      />
      <div className="text-red-400 text-[12px]">{err || <>&nbsp;</>}</div>
    </div>
  );
};
