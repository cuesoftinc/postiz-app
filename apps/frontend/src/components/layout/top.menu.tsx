'use client';

import { FC, ReactNode, useCallback } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { MenuItem } from '@gitroom/frontend/components/new-layout/menu-item';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { AgentMediaModal } from '@gitroom/frontend/components/layout/agent.media.modal';

interface MenuItemInterface {
  name: string;
  icon: ReactNode;
  path: string;
  role?: string[];
  hide?: boolean;
  requireBilling?: boolean;
  onClick?: () => void;
}

export const useMenuItem = () => {
  const { isGeneral } = useVariables();
  const t = useT();
  const { openModal } = useModals();

  const handleAgentMediaClick = useCallback(() => {
    openModal({
      title: t('agent_media_title', 'UGC videos by AgentMedia'),
      closeOnClickOutside: true,
      closeOnEscape: true,
      children: <AgentMediaModal />,
    });
  }, [openModal, t]);

  const firstMenu = [
    {
      name: isGeneral ? t('calendar', 'Publish') : t('launches', 'Launches'),
      icon: (
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
        >
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
      ),
      path: '/launches',
    },
    {
      name: 'Agent',
      icon: (
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
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      ),
      path: '/agents',
    },
    {
      name: t('analytics', 'Insights'),
      icon: (
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
        >
          <path d="M3 3V21H21M18 17V9M13 17V5M8 17V14" />
        </svg>
      ),
      path: '/analytics',
    },
    {
      name: t('media', 'Media'),
      icon: (
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
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
      path: '/media',
    },
    {
      name: t('plugs', 'Plugs'),
      icon: (
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
        >
          <path d="M12 22v-5" />
          <path d="M9 8V2" />
          <path d="M15 8V2" />
          <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
        </svg>
      ),
      path: '/plugs',
    },
    {
      name: t('integrations', 'Integrations'),
      icon: (
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
        >
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
      ),
      path: '/third-party',
    },
  ] satisfies MenuItemInterface[] as MenuItemInterface[];

  const secondMenu = [
    {
      name: t('UGC', 'UGC'),
      icon: (
        <svg
          fill="currentColor"
          height="30"
          width="20"
          version="1.1"
          id="Layer_1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 408.333 408.333"
        >
          <g id="SVGRepo_bgCarrier" strokeWidth="0" />
          <g
            id="SVGRepo_tracerCarrier"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <g id="SVGRepo_iconCarrier">
            <g id="XMLID_230_">
              <g>
                <path d="M311.056,164.871c41.82-8.912,73.109-49.495,73.109-84.871c0-70-40-80-40-80c0,71.666-19.216,85.621-20,86.666V30 c-50,10-50,96.666-50,116.667c0,7.415-5.414,13.575-12.494,14.773c-5.775-44.153-20.583-71.803-33.729-88.309 c5.77-6.311,12.488-17.252,15.099-35.229c6.586-3.272,11.124-10.049,11.124-17.902c0-11.045-8.955-20-20-20 c-11.046,0-20,8.955-20,20c0,6.912,3.506,13.003,8.837,16.596c-1.916,11.42-5.84,18.233-8.98,22.042 c-5.889-4.981-9.856-6.971-9.856-6.971s-3.968,1.99-9.856,6.971c-3.141-3.809-7.064-10.622-8.98-22.042 c5.33-3.593,8.837-9.685,8.837-16.596c0-11.045-8.955-20-20-20c-11.046,0-20,8.955-20,20c0,7.854,4.537,14.63,11.124,17.902 c2.61,17.977,9.329,28.917,15.099,35.229c-13.146,16.506-27.953,44.156-33.729,88.309c-7.08-1.198-12.494-7.358-12.494-14.773 c0-20,0-106.667-50-116.667v56.666c-0.784-1.045-20-15-20-86.666c0,0-40,10-40,80c0,35.377,31.289,75.96,73.109,84.871 c7.002,19.898,25.135,34.588,46.893,36.558c0,0.08-0.002,0.157-0.002,0.237v15h-21c-13.785,0-25-11.215-25-25h-20 c0,24.813,20.187,45,45,45h21v15h-21c-24.813,0-45,20.187-45,45h20c0-13.785,11.215-25,25-25h21 c0,8.095,3.213,15.436,8.425,20.833c-5.212,5.397-8.425,12.737-8.425,20.833c0,10.41,5.304,19.578,13.355,24.958L134.166,385 c0,0,19.213,23.333,70,23.333c50.787,0,70-23.333,70-23.333l-23.354-46.709c8.051-5.38,13.354-14.548,13.354-24.958 c0-8.096-3.213-15.436-8.425-20.833c5.212-5.397,8.425-12.738,8.425-20.833h21c13.785,0,25,11.215,25,25h20 c0-24.813-20.186-45-45-45h-21v-15h21c24.814,0,45-20.187,45-45h-20c0,13.785-11.215,25-25,25h-21v-15 c0-0.08-0.002-0.158-0.002-0.237C285.923,199.459,304.054,184.77,311.056,164.871z" />
              </g>
            </g>
          </g>
        </svg>
      ),
      path: '#',
      role: ['ADMIN', 'SUPERADMIN', 'USER'],
      requireBilling: true,
      onClick: handleAgentMediaClick,
    },
    {
      name: t('affiliate', 'Affiliate'),
      icon: (
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
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      path: 'https://affiliate.postiz.com',
      role: ['ADMIN', 'SUPERADMIN', 'USER'],
      requireBilling: true,
    },
    {
      name: t('billing', 'Billing'),
      icon: (
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
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 18V6" />
        </svg>
      ),
      path: '/billing',
      role: ['ADMIN', 'SUPERADMIN'],
      requireBilling: true,
    },
    {
      name: t('settings', 'Settings'),
      icon: (
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
        >
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      path: '/settings',
      role: ['ADMIN', 'USER', 'SUPERADMIN'],
    },
  ] satisfies MenuItemInterface[] as MenuItemInterface[];

  return {
    all: [...firstMenu, ...secondMenu],
    firstMenu,
    secondMenu,
  };
};

export const TopMenu: FC = () => {
  const user = useUser();
  const { firstMenu, secondMenu } = useMenuItem();
  const { isGeneral, billingEnabled } = useVariables();
  return (
    <>
      <div className="flex flex-1 flex-col minCustom:gap-[16px] blurMe phone:contents">
        {
          // @ts-ignore
          user?.orgId &&
            // @ts-ignore
            (user.tier !== 'FREE' || !isGeneral || !billingEnabled) &&
            firstMenu
              .filter((f) => {
                if (f.hide) {
                  return false;
                }
                if (f.requireBilling && !billingEnabled) {
                  return false;
                }
                if (f.name === 'Billing' && user?.isLifetime) {
                  return false;
                }
                if (f.role) {
                  return f.role.includes(user?.role!);
                }
                return true;
              })
              .map((item, index) => (
                <MenuItem
                  path={item.path}
                  label={item.name}
                  icon={item.icon}
                  key={item.name}
                  onClick={item.onClick}
                />
              ))
        }
      </div>
      <div className="flex flex-col minCustom:gap-[20px] custom:gap-[8px] blurMe phone:contents">
        {secondMenu
          .filter((f) => {
            if (f.hide) {
              return false;
            }
            if (f.requireBilling && !billingEnabled) {
              return false;
            }
            if (f.name === 'Billing' && user?.isLifetime) {
              return false;
            }
            if (f.role) {
              return f.role.includes(user?.role!);
            }
            return true;
          })
          .map((item, index) => (
            <MenuItem
              path={item.path}
              label={item.name}
              icon={item.icon}
              key={item.name}
              onClick={item.onClick}
            />
          ))}
      </div>
    </>
  );
};
