import { redirect } from 'next/navigation';

export default async function CvProfileAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profileId = typeof id === 'string' ? id.trim() : '';
  redirect(profileId ? `/dashboard/cv-profiles?profileId=${encodeURIComponent(profileId)}` : '/dashboard/cv-profiles');
}

