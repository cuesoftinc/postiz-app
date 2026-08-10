'use client';

import '@neynar/react/dist/style.css';
import React, { FC, useMemo, useState, useCallback, useEffect } from 'react';
import { Web3ProviderInterface } from '@gitroom/frontend/components/launches/web3/web3.provider.interface';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  Skeleton,
  SkeletonText,
} from '@gitroom/frontend/components/layout/skeleton';
import {
  NeynarAuthButton,
  NeynarContextProvider,
  Theme,
  useNeynarContext,
} from '@neynar/react';
import { INeynarAuthenticatedUser } from '@neynar/react/dist/types/common';
import { ButtonCaster } from '@gitroom/frontend/components/auth/providers/farcaster.provider';
export const WrapcasterProvider: FC<Web3ProviderInterface> = (props) => {
  const [_, state] = props.nonce.split('||');
  const modal = useModals();
  const [hide, setHide] = useState(false);
  const auth = useCallback(
    (code: string) => {
      setHide(true);
      return props.onComplete(code, state);
    },
    [state]
  );
  return (
    <div className="justify-center items-center flex">
      {hide ? (
        // skeleton pane in the same 500px column the button pane used —
        // never a spinner
        <div className="py-[20px] flex flex-col gap-[12px] w-[500px]">
          <Skeleton className="h-[16px] w-[55%]" />
          <SkeletonText rows={3} />
        </div>
      ) : (
        <div className="justify-center items-center py-[20px] flex-col w-[500px]">
          <div>Click on the bottom below to start the process</div>
          <ButtonCaster login={auth} />
        </div>
      )}
    </div>
  );
};
