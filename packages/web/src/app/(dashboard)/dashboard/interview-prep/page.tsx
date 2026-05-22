import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * Backend strategic coaching may link to `/dashboard/interview-prep`.
 * Interview setup lives at `/dashboard/interview`; forward query params unchanged.
 */
export default async function InterviewPrepAliasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = first(v).trim();
    if (val) qp.set(k, val);
  }
  const suffix = qp.toString();
  redirect(`/dashboard/interview${suffix ? `?${suffix}` : ''}`);
}
