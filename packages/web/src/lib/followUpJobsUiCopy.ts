import type { FollowUpJobRowPayload } from '@/lib/today-plan';

/** One clear sentence for the command bar / notices when we have a concrete first queue row. */
export function descriptiveFollowUpLeadIn(first: FollowUpJobRowPayload): string {
  const company = first.companyName?.trim() ?? '';
  const jt = first.jobTitle?.trim() ?? '';
  const roleAt =
    jt && company ? `${jt} at ${company}` : jt ? jt : company ? `at ${company}` : 'this role';

  const src = (first.source ?? '').trim().toLowerCase();

  if (src === 'analysis') {
    if (jt && company) return `Follow up on the analyzed job ${jt} at ${company}.`;
    if (jt) return `Follow up on the analyzed job ${jt}.`;
    if (company) return `Follow up on your analyzed job at ${company}.`;
    return 'Follow up on a job you analyzed.';
  }
  if (src === 'bookmark') {
    if (jt && company) return `Follow up on your bookmarked role ${jt} at ${company}.`;
    if (jt) return `Follow up on your bookmarked role ${jt}.`;
    if (company) return `Follow up on a bookmarked role at ${company}.`;
    return 'Follow up on a role you bookmarked.';
  }
  if (src === 'application') {
    if (jt && company) return `Follow up on your application for ${jt} at ${company}.`;
    if (jt) return `Follow up on your application for ${jt}.`;
    if (company) return `Follow up on an application at ${company}.`;
    return 'Follow up on an application in your pipeline.';
  }

  if (jt && company) return `Follow up on ${roleAt}.`;
  if (jt) return `Follow up on ${jt}.`;
  if (company) return `Follow up at ${company}.`;
  return 'Follow up on a role in your queue.';
}
