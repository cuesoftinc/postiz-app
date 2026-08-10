'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import useCookie from 'react-use-cookie';
import {
  AUTH_LINK,
  AUTH_TITLE,
} from '@gitroom/frontend/components/auth/auth.ui';
export const AfterActivate = () => {
  const fetch = useFetch();
  const params = useParams();
  const [showLoader, setShowLoader] = useState(true);
  const run = useRef(false);
  const t = useT();
  const [datafast_visitor_id] = useCookie('datafast_visitor_id');

  useEffect(() => {
    if (!run.current) {
      run.current = true;
      loadCode();
    }
  }, []);
  const loadCode = useCallback(async () => {
    if (params.code) {
      const { can } = await (
        await fetch(`/auth/activate`, {
          method: 'POST',
          body: JSON.stringify({
            code: params.code,
            datafast_visitor_id,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })
      ).json();
      if (!can) {
        setShowLoader(false);
      }
    }
  }, []);
  return (
    <>
      {showLoader ? (
        <LoadingComponent />
      ) : (
        <div className="flex flex-col flex-1 gap-[8px]">
          <h1 className={AUTH_TITLE}>
            {t('already_activated_title', 'Account already activated')}
          </h1>
          <div className="text-[14px] text-newTextColor/60">
            {t(
              'already_activated_subline',
              'This user is already activated.'
            )}
          </div>
          <p className="mt-[8px]">
            <Link href="/auth" className={AUTH_LINK}>
              {t(
                'click_here_to_go_back_to_login',
                'Click here to go back to login'
              )}
            </Link>
          </p>
        </div>
      )}
    </>
  );
};
