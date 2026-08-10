'use client';

import React, { FC, useCallback } from 'react';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

/** The logout flow, extracted verbatim from LogoutComponent so the sidebar's
 *  org row menu can reuse it without rendering this component's control:
 *  confirm dialog, then cookie clear (not-secured self-host) or the
 *  POST /user/logout oauth flow, then the hard redirect to '/'. */
export const useLogout = () => {
  const fetch = useFetch();
  const { isSecured } = useVariables();
  const t = useT();

  return useCallback(async () => {
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
};

/** Lucide log-out, the kit's 16/2.2 glyph pair with the menu rows. */
const LogOutIcon: FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </svg>
);

/** Standalone logout control (settings General tab, billing pages). Restyled
 *  to the kit: quiet 32px hairline button, log-out glyph + label 14/500,
 *  critical ink on hover. The primary logout entry point is now the sidebar
 *  org row menu; this stays for the surfaces that render it inline. */
export const LogoutComponent: FC<{ isIcon?: boolean }> = ({ isIcon }) => {
  const { isGeneral } = useVariables();
  const t = useT();
  const logout = useLogout();

  if (isIcon) {
    return (
      <div className="cursor-pointer" onClick={logout}>
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
          ${isGeneral ? ' Cuesoft' : ' Gitroom'}
          `}
        >
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </svg>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="h-[32px] px-[12px] inline-flex items-center gap-[8px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:text-[#FF3F3F] hover:bg-boxHover transition-colors duration-150"
    >
      <LogOutIcon />
      <span>
        {t('log_out_from', 'Log out from')}
        {isGeneral ? ' Cuesoft' : ' Gitroom'}
      </span>
    </button>
  );
};
