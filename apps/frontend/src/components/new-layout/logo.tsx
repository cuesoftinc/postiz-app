'use client';

export const Logo = () => {
  // Theme-aware: white mark in dark mode, primary (blue) mark in light mode.
  // Tailwind darkMode:'class' — the mode toggle puts `dark`/`light` on <body>.
  return (
    <>
      <img
        src="/cuesoft-mark-white.png"
        alt="Cuesoft"
        width={60}
        height={60}
        className="mt-[8px] min-w-[60px] min-h-[60px] object-contain hidden dark:block"
      />
      <img
        src="/cuesoft-mark-primary.png"
        alt="Cuesoft"
        width={60}
        height={60}
        className="mt-[8px] min-w-[60px] min-h-[60px] object-contain block dark:hidden"
      />
    </>
  );
};
