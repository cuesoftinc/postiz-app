'use client';

import { useCallback, useEffect, useState } from 'react';
import { useClickAway } from '@uidotdev/usehooks';

/**
 * Fork-owned (cuesoft). Open-state + dismissal for hand-rolled popovers
 * (plan row 13's companion hook). One dismissal contract everywhere:
 * click-away closes, Escape closes, the trigger toggles.
 *
 * The returned ref goes on the wrapper that contains BOTH the trigger and
 * the panel (the `relative` anchor), matching how the notification bell
 * already structured its click-away.
 */
export const useDropdown = <T extends HTMLElement = HTMLDivElement>() => {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const ref = useClickAway<T>(close);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return { open, setOpen, toggle, close, ref };
};
