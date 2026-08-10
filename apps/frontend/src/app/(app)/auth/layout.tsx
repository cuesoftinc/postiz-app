export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));

/**
 * Auth shell on today's kit. Auth always renders LIGHT: the parent
 * app/(app)/layout.tsx puts the mode cookie's class on <body> (dark by
 * default for anonymous visitors) and already loads the Inter / Plus
 * Jakarta / Fustat font variables, so the `light` class on this wrapper
 * re-resolves every `--new-*` token to the light palette for the whole
 * subtree. Auth components therefore must not use `dark:` variants (the
 * body's `.dark` would still activate them) — kit tokens only.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="light bg-newBgColor text-newTextColor min-h-screen w-full flex flex-col items-center justify-center py-[40px] px-[16px]">
      <ReturnUrlComponent />
      {/* brand rule: mark + lowercase "cuesoft" in Fustat, centered above the
          card. Forced-light surface, so the primary (light-mode) mark is used
          directly instead of the dark:-swapping LogoTextComponent. */}
      <div className="flex items-center justify-center gap-[8px] mb-[24px]">
        <img
          src="/cuesoft-mark-primary.png"
          alt="Cuesoft"
          width={28}
          height={28}
          className="object-contain"
        />
        <span className="[font-family:var(--font-fustat)] text-[24px] font-[700] leading-none text-newTextColor">
          cuesoft
        </span>
      </div>
      {/* card: white, r16, hairline, generous padding, soft shadow;
          full-width on phones (the outer px-[16px] is the inset) */}
      <div className="w-full max-w-[420px] bg-newBgColorInner rounded-[16px] border border-newTableBorder p-[32px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.06)] flex flex-col">
        {children}
      </div>
    </div>
  );
}
