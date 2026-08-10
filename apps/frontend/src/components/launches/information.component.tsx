'use client';

import React, { FC, Fragment, useMemo } from 'react';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { capitalize } from 'lodash';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { hasLinks } from '@gitroom/helpers/utils/strip.links';

const Valid: FC = () => {
  return (
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
      className="text-[#00EB75]"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
};

const Invalid: FC = () => {
  return (
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
      className="text-white"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
};
export const InformationComponent: FC<{
  chars: Record<string, number>;
  totalChars: number;
  totalAllowedChars: number;
  isPicture: boolean;
  text?: string;
}> = ({ totalChars, totalAllowedChars, chars, isPicture, text }) => {
  const t = useT();
  const { isGlobal, selectedIntegrations, internal, currentIntegration } =
    useLaunchStore(
      useShallow((state) => ({
        isGlobal: state.current === 'global',
        selectedIntegrations: state.selectedIntegrations,
        internal: state.internal,
        currentIntegration: state.integrations.find(
          (p) => p.id === state.current
        ),
      }))
    );

  const stripLinkNames = useMemo(() => {
    if (!hasLinks(text)) {
      return [] as string[];
    }

    if (!isGlobal) {
      return currentIntegration?.stripLinks ? [currentIntegration.name] : [];
    }

    return selectedIntegrations
      .filter((p) => p.integration.stripLinks)
      .map((p) => p.integration.name);
  }, [text, isGlobal, currentIntegration, selectedIntegrations]);

  const showStripLinkWarning = stripLinkNames.length > 0;

  const isInternal = useMemo(() => {
    if (!isGlobal) {
      return [];
    }
    return selectedIntegrations.map((p) => {
      const findIt = internal.find(
        (a) => a.integration.id === p.integration.id
      );

      return !!findIt;
    });
  }, [isGlobal, internal, selectedIntegrations]);

  const isValid = useMemo(() => {
    if (showStripLinkWarning) {
      return false;
    }

    if (!isPicture && !totalChars) {
      return false;
    }

    if (totalChars > totalAllowedChars && !isGlobal) {
      return false;
    }

    if (totalChars <= totalAllowedChars && !isGlobal) {
      return true;
    }

    if (
      selectedIntegrations.some((p, index) => {
        if (isInternal[index]) {
          return false;
        }

        return totalChars > (chars?.[p.integration.id] || 0);
      })
    ) {
      return false;
    }

    return true;
  }, [
    totalAllowedChars,
    totalChars,
    isInternal,
    isPicture,
    chars,
    showStripLinkWarning,
  ]);

  const globalDisplayLimit = useMemo(() => {
    if (!isGlobal || !selectedIntegrations.length) {
      return null;
    }

    // Get all limits from non-internal integrations, sorted ascending
    const limits = selectedIntegrations
      .map((p, index) => ({
        limit: chars?.[p.integration.id] || 0,
        isInternal: isInternal[index],
      }))
      .filter((item) => !item.isInternal && item.limit > 0)
      .map((item) => item.limit)
      .sort((a, b) => a - b);

    if (!limits.length) {
      return null;
    }

    // Find the smallest limit that hasn't been exceeded yet
    // If all are exceeded, show the smallest one
    const validLimit = limits.find((limit) => totalChars <= limit);
    return validLimit ?? limits[0];
  }, [isGlobal, selectedIntegrations, chars, isInternal, totalChars]);

  return (
    <div
      className={clsx(
        'group rounded-[6px] gap-[4px] h-[30px] px-[6px] flex justify-center items-center relative',
        isValid ? 'border border-newColColor' : 'bg-[#FF3F3F]'
      )}
    >
      {isValid ? <Valid /> : <Invalid />}

      {!isGlobal && (
        <div className={clsx("text-[10px] font-[600] flex justify-center items-center", !isValid && 'text-white')}>
          {totalChars}/{totalAllowedChars}
        </div>
      )}
      {isGlobal && globalDisplayLimit !== null && (
        <div className={clsx("text-[10px] font-[600] flex justify-center items-center", !isValid && 'text-white')}>
          {totalChars}/{globalDisplayLimit}
        </div>
      )}
      {((isGlobal && selectedIntegrations.length) || !isValid) && (
        <svg
          className={clsx('group-hover:rotate-180', !isValid && 'text-white')}
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
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
      {((isGlobal && selectedIntegrations.length) || !isValid) && (
        <div
          className={clsx(
            'z-[300] hidden rounded-[12px] bg-newBgColorInner group-hover:flex absolute end-0 bottom-[100%] mb-[5px] p-[12px] flex-col',
            isValid ? 'border border-newColColor' : 'border border-[#FF3F3F]'
          )}
        >
          {!isPicture && !totalChars && (
            <div
              className={clsx(
                'text-sm text-[#FF3F3F] whitespace-nowrap',
                isGlobal && selectedIntegrations.length && 'mb-[12px]'
              )}
            >
              {t('your_post_should_have_at_least_one_character_or_one_image', 'Your post should have at least one character or one image.')}
            </div>
          )}
          {isGlobal && (
            <div className="grid grid-cols-[auto_auto_auto] text-[14px] font-[500] gap-[8px] items-center">
              {selectedIntegrations.map((p, index) => (
                <Fragment key={p.integration.id}>
                  <div>
                    <SafeImage
                      src={`/icons/platforms/${p.integration.identifier}.png`}
                      alt={p.integration.name}
                      className="rounded-[4px] w-[16px] h-[16px] min-w-[16px] min-h-[16px]"
                      width={16}
                      height={16}
                    />
                  </div>
                  <div
                    className={clsx(
                      'whitespace-nowrap',
                      isInternal?.[index]
                        ? ''
                        : totalChars > (chars?.[p.integration.id] || 0)
                        ? 'text-[#FF3F3F]'
                        : ''
                    )}
                  >
                    {p.integration.name} (
                    {capitalize(p.integration.identifier.split('-')[0])}):
                  </div>
                  <div
                    className={clsx(
                      'whitespace-nowrap',
                      isInternal?.[index]
                        ? ''
                        : totalChars > (chars?.[p.integration.id] || 0)
                        ? 'text-[#FF3F3F]'
                        : ''
                    )}
                  >
                    {isInternal?.[index]
                      ? t('internal_edit', 'Internal Edit')
                      : `${totalChars}/${chars?.[p.integration.id] || 0}`}
                  </div>
                </Fragment>
              ))}
            </div>
          )}
          {showStripLinkWarning && (
            <div
              className={clsx(
                'text-sm text-[#FF3F3F] whitespace-nowrap',
                ((isGlobal && selectedIntegrations.length) ||
                  (!isPicture && !totalChars)) &&
                  'mt-[12px]'
              )}
            >
              {t('links_will_be_removed_from', 'Links will be removed from')}:{' '}
              {stripLinkNames.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
