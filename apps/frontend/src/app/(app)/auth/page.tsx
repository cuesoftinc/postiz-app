export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Cuesoft' : 'Gitroom'} - Sign In`,
  description: '',
};
// Closed, invite-only system: /auth IS the sign-in page (Google SSO + email
// fallback + password reset). Register renders ONLY mid OAuth callback
// (provider + code), which is how SSO onboarding and sign-in complete; there
// is no self-serve signup form.
export default async function Auth(params: {
  searchParams: Promise<{ provider?: string; code?: string }>;
}) {
  const search = await params?.searchParams;
  if (search?.provider && search?.code) {
    return <Register />;
  }
  return <Login />;
}
