import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
// /auth is the sign-in page; this route survives only so old bookmarks and
// emailed links keep working.
export default async function AuthLogin(params: {
  searchParams: Promise<Record<string, string>>;
}) {
  const search = new URLSearchParams(await params?.searchParams).toString();
  redirect(`/auth${search ? `?${search}` : ''}`);
}
