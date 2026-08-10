'use client';

import { useCallback, useEffect, useState } from 'react';
import useCookie from 'react-use-cookie';
import EventEmitter from 'events';

export const modeEmitter = new EventEmitter();

const ModeComponent = () => {
  const [mode, setMode] = useCookie('mode', 'dark');

  const changeMode = useCallback(() => {
    modeEmitter.emit('mode', mode === 'dark' ? 'light' : 'dark');
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode]);

  useEffect(() => {
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(mode);
  }, [mode]);
  return (
    <div onClick={changeMode} className="select-none cursor-pointer">
      {mode === 'dark' ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </div>
  );
};
export default ModeComponent;
