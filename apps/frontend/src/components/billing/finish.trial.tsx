import React, { FC, useCallback, useEffect, useState } from 'react';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { timer } from '@gitroom/helpers/utils/timer';
import { Button } from '@gitroom/react/form/button';
import { ModalCloseButton } from '@gitroom/frontend/components/cuesoft/modal/modal-close-button';
import { ModalFooter } from '@gitroom/frontend/components/cuesoft/modal/modal-footer';

export const FinishTrial: FC<{ close: () => void }> = (props) => {
  const [finished, setFinished] = useState(false);
  const fetch = useFetch();

  const finishSubscription = useCallback(async () => {
    await fetch('/billing/finish-trial', {
      method: 'POST',
    });
    checkFinished();
  }, []);

  const checkFinished = useCallback(async () => {
    const {finished} = await (await fetch('/billing/is-trial-finished')).json();
    if (!finished) {
      await timer(2000);
      return checkFinished();
    }

    setFinished(true);
  }, []);

  useEffect(() => {
    finishSubscription();
  }, []);

  return (
    <div className="text-textColor fixed start-0 top-0 bg-popup z-[300] w-full h-full p-[60px] animate-fade justify-center flex">
      <div>
        <div className="flex gap-[10px] flex-col w-[500px] h-auto bg-newBgColorInner border border-newTableBorder rounded-[16px] pb-[20px] px-[20px] relative">
          <div className="flex">
            <div className="flex-1">
              <TopTitle title={'Finishing Trial'} />
            </div>
            <ModalCloseButton
              onClick={props.close}
              offset={{ top: 10, end: 10 }}
            />
          </div>
          <div className="relative h-[400px]">
            <div className="absolute left-0 top-0 w-full h-full overflow-hidden overflow-y-auto">
              <div className="mt-[10px] flex w-full justify-center items-center gap-[10px]">
                {!finished && <LoadingComponent height={150} width={150} />}
                {finished && (
                  <div className="flex flex-col">
                    <div>
                      Your trial has ended and your subscription is now active.
                    </div>
                    <ModalFooter align="stretch">
                      <Button secondary={true} onClick={() => window.close()}>Close window</Button>
                      <Button onClick={() => props.close()}>Close dialog</Button>
                    </ModalFooter>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
