'use client';

import React, { FC, useCallback } from 'react';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const LogoutComponent: FC<{ isIcon?: boolean }> = ({ isIcon }) => {
  const fetch = useFetch();
  const { isGeneral, isSecured } = useVariables();
  const t = useT();

  const logout = useCallback(async () => {
    if (
      await deleteDialog(
        t(
          'are_you_sure_you_want_to_logout',
          'Are you sure you want to logout?'
        ),
        t('yes_logout', 'Yes logout')
      )
    ) {
      if (!isSecured) {
        setCookie('auth', '', -10);
      } else {
        await fetch('/user/logout', {
          method: 'POST',
        });
      }
      window.location.href = '/';
    }
  }, []);
  return (
    <>
      <div className="cursor-pointer" onClick={logout}>
        {isIcon ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
            data-tooltip-id="tooltip"
            data-tooltip-content={`
            ${t('logout_from', 'Logout from')}${' '}
            ${isGeneral ? ' Postiz' : ' Gitroom'}
            `}
          >
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          </svg>
        ) : (
          <span className="text-red-400">
            {t('logout_from', 'Logout from')}
            {isGeneral ? ' Postiz' : ' Gitroom'}
          </span>
        )}
      </div>
    </>
  );
};
