import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ModalCloseButton } from '@gitroom/frontend/components/cuesoft/modal/modal-close-button';
import React, { FC } from 'react';
import { Button } from '@gitroom/react/form/button';
import copy from 'copy-to-clipboard';
import { useToaster } from '@gitroom/react/toaster/toaster';

export const DummyCodeComponent: FC<{ code: any }> = ({ code }) => {
  const modal = useModals();
  const toaster = useToaster();

  return (
    <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative w-full">
      <TopTitle title={`Output`}>
        <Button
          className="mr-[50px]"
          onClick={() => {
            copy(JSON.stringify(code, null, 2));
            toaster.show('Code copied to clipboard', 'success');
          }}
        >
          Copy Code
        </Button>
      </TopTitle>
      <ModalCloseButton onClick={() => modal.closeAll()} />
      <pre>{JSON.stringify(code, null, 2)}</pre>
    </div>
  );
};
