import React from 'react';

export const LogoTextComponent = () => {
  // Theme-aware: white mark in dark mode, primary (blue) mark in light mode.
  // Tailwind darkMode:'class' — the mode toggle puts `dark`/`light` on <body>.
  return (
    <>
      <img
        src="/cuesoft-mark-white.png"
        alt="Cuesoft"
        width={101}
        height={33}
        className="object-contain object-left hidden dark:block"
      />
      <img
        src="/cuesoft-mark-primary.png"
        alt="Cuesoft"
        width={101}
        height={33}
        className="object-contain object-left block dark:hidden"
      />
    </>
  );
};
