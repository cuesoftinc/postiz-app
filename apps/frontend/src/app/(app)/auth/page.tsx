import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
export const dynamic = 'force-dynamic';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { redirect } from 'next/navigation';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Cuesoft' : 'Gitroom'} Register`,
  description: '',
};
export default async function Auth(params: {
  searchParams: Promise<{ provider: string }>;
}) {
  if (process.env.DISABLE_REGISTRATION === 'true') {
    const canRegister = (
      await (await internalFetch('/auth/can-register')).json()
    ).register;
    if (!canRegister && !(await params?.searchParams)?.provider) {
      redirect('/auth/login');
    }
  }
  return <Register />;
}
