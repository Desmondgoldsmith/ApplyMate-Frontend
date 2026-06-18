import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Backend Phase 18A deep links: `/dashboard/jobs/<applicationId>?tab=email-templates&template=…`.
 * Canonical Job Hub UI reads `applicationId` (and related keys) from query on `/dashboard/jobs`.
 */
export default async function JobsApplicationDeepLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { applicationId } = await params;
  const id = typeof applicationId === 'string' ? applicationId.trim() : '';
  const sp = await searchParams;

  /** Static sibling routes — avoid treating `archive` / `analyze` as application IDs. */
  if (id === 'archive') {
    const archiveQp = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const part of value) {
          if (typeof part === 'string' && part) archiveQp.append(key, part);
        }
      } else if (typeof value === 'string' && value) {
        archiveQp.set(key, value);
      }
    }
    const archiveSuffix = archiveQp.toString();
    redirect(`/dashboard/jobs/archive${archiveSuffix ? `?${archiveSuffix}` : ''}`);
  }
  if (id === 'analyze') {
    redirect('/dashboard/jobs/analyze');
  }

  const qp = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const part of value) {
        if (typeof part === 'string' && part) qp.append(key, part);
      }
    } else if (typeof value === 'string' && value) {
      qp.set(key, value);
    }
  }

  if (id && !qp.get('applicationId')) qp.set('applicationId', id);

  const suffix = qp.toString();
  redirect(`/dashboard/jobs${suffix ? `?${suffix}` : ''}`);
}
