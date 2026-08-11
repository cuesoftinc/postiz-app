'use client';

import { useCallback, useEffect, useState } from 'react';
import { useClickAway } from '@uidotdev/usehooks';

/**
 * Fork-owned (cuesoft). Open-state + dismissal for hand-rolled popovers
 * (plan row 13's companion hook). One dismissal contract everywhere:
 * click-away closes, Escape closes, the trigger toggles.
 *
 * The returned ref goes on the wrapper that contains the trigger (the
 * `relative` anchor), matching how the notification bell already structured
 * its click-away. NOTE: DropdownPanel is PORTALED into document.body, so the
 * open panel is NOT inside this ref's subtree anymore; useClickAway's
 * document-level mousedown/touchstart handlers would read presses inside the
 * panel as outside. The panel itself compensates - it stops those events
 * from reaching document (see dropdown-panel.tsx), so this hook needs no
 * panel ref and raw useClickAway call sites keep working unchanged.
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
