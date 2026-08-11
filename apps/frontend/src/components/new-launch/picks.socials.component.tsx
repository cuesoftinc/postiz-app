'use client';

import { FC } from 'react';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';
import {
  CheckmarkIcon,
  PlusIcon,
} from '@gitroom/frontend/components/ui/icons';

export const PicksSocialsComponent: FC<{ toolTip?: boolean }> = ({
  toolTip,
}) => {
  const exising = useExistingData();
  const addProvider = useAddProvider();

  const {
    locked,
    addOrRemoveSelectedIntegration,
    integrations,
    selectedIntegrations,
    dummy,
  } = useLaunchStore(
    useShallow((state) => ({
      integrations: state.integrations,
      selectedIntegrations: state.selectedIntegrations,
      addOrRemoveSelectedIntegration: state.addOrRemoveSelectedIntegration,
      locked: state.locked,
      dummy: state.dummy,
    }))
  );

  return (
    <div className={clsx('flex', locked && 'opacity-50 pointer-events-none')}>
      <div className="flex flex-1">
        <div className="innerComponent flex-1 flex">
          {/* Buffer channels row: 40px r12 tiles (measured on Buffer's
              composer), 16px platform badge bottom-right; selected = lime
              ring, unselected = dimmed. */}
          <div className="flex flex-wrap gap-[12px] flex-1 items-center">
            {integrations
              .filter((f) => {
                if (exising.integration) {
                  return f.id === exising.integration;
                }
                return !f.inBetweenSteps && !f.disabled;
              })
              .map((integration) => {
                const selected =
                  selectedIntegrations.findIndex(
                    (p) => p.integration.id === integration.id
                  ) !== -1;
                return (
                  <div
                    key={integration.id}
                    className="flex gap-[8px] items-center"
                    {...(toolTip && {
                      'data-tooltip-id': 'tooltip',
                      'data-tooltip-content': integration.name,
                    })}
                  >
                    <div
                      data-cs
                      onClick={() => {
                        if (exising.integration) {
                          return;
                        }
                        addOrRemoveSelectedIntegration(integration, {});
                      }}
                      className={clsx(
                        'cursor-pointer relative w-[40px] h-[40px] rounded-[12px] flex justify-center items-center transition-all',
                        selected
                          ? 'ring-2 ring-btnPrimary'
                          : 'opacity-60 hover:opacity-100'
                      )}
                    >
                      {/* SafeImage drops unknown props, so the r12 +
                          data-cs (ladder opt-out) live on a wrapper div */}
                      <div
                        data-cs
                        className="w-[40px] h-[40px] rounded-[12px] overflow-hidden"
                      >
                        <ImageWithFallback
                          fallbackSrc="/no-picture.jpg"
                          src={integration.picture || '/no-picture.jpg'}
                          className="w-full h-full object-cover"
                          alt={integration.identifier}
                          width={40}
                          height={40}
                        />
                      </div>
                      {/* Buffer deselect badge: 24x24 r6 white on the
                          selected tile (the tile itself is the toggle, so
                          the badge deselects on click too). Fixed ink so it
                          reads on the white square in both themes. */}
                      {selected && (
                        <div
                          data-cs
                          className="absolute z-20 -top-[6px] -end-[6px] w-[24px] h-[24px] rounded-[6px] bg-white border border-newTableBorder flex items-center justify-center text-[#292928]"
                        >
                          <CheckmarkIcon />
                        </div>
                      )}
                      {integration.identifier === 'youtube' ? (
                        <img
                          src="/icons/platforms/youtube.svg"
                          className="absolute z-10 -bottom-[3px] -end-[3px] min-w-[16px]"
                          width={16}
                        />
                      ) : (
                        <SafeImage
                          src={`/icons/platforms/${integration.identifier}.png`}
                          className="rounded-[4px] absolute z-10 -bottom-[3px] -end-[3px] min-w-[16px] min-h-[16px]"
                          alt={integration.identifier}
                          width={16}
                          height={16}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            {/* 40x40 r8 hairline '+' square -> the existing connect-channel
                modal (useAddProvider). Hidden while editing an existing
                post (the row is locked to one channel) and in dummy mode. */}
            {!exising.integration && !dummy && (
              <div
                data-cs
                onClick={addProvider}
                data-tooltip-id="tooltip"
                data-tooltip-content="Connect a new channel"
                className="cursor-pointer w-[40px] h-[40px] rounded-[8px] border border-newTableBorder flex justify-center items-center text-newTextColor/60 hover:text-newTextColor hover:bg-newTableHeader transition-colors"
              >
                <PlusIcon />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
