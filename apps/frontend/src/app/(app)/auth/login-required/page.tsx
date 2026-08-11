export default async function LoginRequiredPage() {
  // Kit interstitial: cream canvas + ink (forced light via the auth layout's
  // `light` wrapper; this fixed overlay is still inside that subtree).
  return (
    <div className="fixed left-0 top-0 w-full h-full bg-newBgColor z-[200] flex justify-center items-center px-[16px]">
      <div className="text-[20px] font-[550] text-newTextColor text-center">
        Login to use the wizard to generate API code
      </div>
    </div>
  );
}
