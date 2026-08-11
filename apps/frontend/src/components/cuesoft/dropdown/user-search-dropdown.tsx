'use client';

import { FC, useEffect } from 'react';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

/**
 * Fork-owned (cuesoft). The impersonate autocomplete panel (plan row 7):
 * full-screen dimming backdrop + results list, extracted from the two
 * near-byte-identical copies in layout/impersonate.tsx (SwitchUser and the
 * impersonate search).
 *
 * Pixel parity contract: backdrop (`bg-primary/80 fixed start-0 top-0 w-full
 * h-full`), panel (`absolute top-[100%] start-0 w-full bg-sixth
 * border border-customColor6 text-newTextColor`) and rows (`p-[10px]
 * border-b border-customColor6 hover:bg-tableBorder cursor-pointer`) are
 * verbatim from the sources. The call site provides the `relative` ancestor,
 * so per-site anchoring is unchanged. Z re-banded from the legacy 998/999
 * pair to the dropdown band (backdrop 99, panel 100 - canonical z scale in
 * global.scss); both resolve inside the impersonate pill's fixed context.
 *
 * Twin-drift fixes baked in (plan-sanctioned):
 * - the row guards an empty name (the impersonate twin printed a dangling
 *   `- name -` dash when the user has no name);
 * - one class order for the panel;
 * - Escape closes the panel (same path as the backdrop click).
 */

export interface UserSearchItem {
  id: string;
  name?: string | null;
  email: string;
}

export const UserSearchDropdown: FC<{
  items: UserSearchItem[];
  onPick: (item: UserSearchItem) => void;
  /** Backdrop click and Escape both land here. */
  onDismiss: () => void;
  className?: string;
}> = ({ items, onPick, onDismiss, className }) => {
  const t = useT();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <>
      <div
        className="bg-primary/80 fixed start-0 top-0 w-full h-full z-[99]"
        onClick={onDismiss}
      />
      <div
        className={clsx(
          'absolute top-[100%] start-0 w-full bg-sixth border border-customColor6 text-newTextColor z-[100]',
          className
        )}
      >
        {items.map((item) => (
          <div
            onClick={() => onPick(item)}
            key={item.id}
            className="p-[10px] border-b border-customColor6 hover:bg-tableBorder cursor-pointer"
          >
            {t('user_1', 'user:')}
            {item.id.split('-').at(-1)} -{' '}
            {item.name ? `${item.name} - ` : ''}
            {item.email}
          </div>
        ))}
      </div>
    </>
  );
};
