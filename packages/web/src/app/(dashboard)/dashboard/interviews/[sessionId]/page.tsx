import { redirect } from 'next/navigation';

export default async function InterviewSessionAliasPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const id = typeof sessionId === 'string' ? sessionId.trim() : '';
  redirect(id ? `/dashboard/interview/${encodeURIComponent(id)}` : '/dashboard/interviews');
}

