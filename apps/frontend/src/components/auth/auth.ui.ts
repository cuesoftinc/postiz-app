/**
 * Shared kit classes for every auth surface (login, register, forgot, reset,
 * activate). Auth renders forced-light inside the auth layout's white card;
 * these converge the shared form primitives onto the card spec without
 * touching the primitives themselves (other consumers keep the 36px/r6 look).
 */

// Card title: 20px / 550 ink.
export const AUTH_TITLE = 'text-[20px] font-[550] text-newTextColor';

// Sublines under the title: 14px muted.
export const AUTH_SUBLINE = 'text-[14px] text-newTextColor/60';

// Shared form <Input> wrapper override: white r8 hairline 44px; hover deepens
// the hairline to #8a8a88 unless the field is focused (focus keeps the
// primitive's focus-within:border-forth).
export const AUTH_INPUT =
  '!h-[44px] !rounded-[8px] [&:hover:not(:focus-within)]:border-[#8a8a88]';

// Primary CTA on the shared <Button>: lime, black ink, 44px, r8, full width.
export const AUTH_BUTTON =
  'w-full flex-1 !h-[44px] !rounded-[8px] text-black text-[14px] font-[550]';

// Secondary links (forgot password, back to login, sign up): Buffer green.
export const AUTH_LINK =
  'text-[14px] text-[#2f7d44] hover:underline cursor-pointer';

// Provider buttons (Google SSO / generic OIDC / GitHub / Farcaster / Wallet):
// white hairline 44px r8, 14/550 ink.
export const AUTH_PROVIDER_BUTTON =
  'cursor-pointer flex-1 h-[44px] bg-newBgColorInner border border-newTableBorder hover:border-[#8a8a88] rounded-[8px] flex justify-center items-center text-newTextColor text-[14px] font-[550] gap-[8px]';
