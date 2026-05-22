/** Values sent to POST /applications/:id/email-templates/generate as `templateType`. */
export const JOB_HUB_EMAIL_TEMPLATE_OPTIONS = [
  { value: 'leveraging_network', label: 'Leveraging my network' },
  { value: 'recruiter_response', label: 'Responding to a recruiter' },
  { value: 'connection_request', label: 'Personalized connection request' },
  { value: 'thank_you_post_interview', label: 'Thank-you after interview' },
  { value: 'salary_or_offer', label: 'Salary / offer discussion' },
  { value: 'hiring_manager_outreach', label: 'Cold outreach to hiring manager' },
  { value: 'referral_request', label: 'Referral / warm intro request' },
  { value: 'follow_up_after_silence', label: 'Follow-up after no reply' },
  { value: 'accept_offer', label: 'Accept offer (professional)' },
  { value: 'decline_offer', label: 'Decline offer politely' },
  { value: 'withdraw_application', label: 'Withdraw application' },
] as const;

export type JobHubEmailTemplateType = (typeof JOB_HUB_EMAIL_TEMPLATE_OPTIONS)[number]['value'];

const INTERNAL_VALUES = new Set<string>(JOB_HUB_EMAIL_TEMPLATE_OPTIONS.map((o) => o.value));

/** Backend / URL slug aliases (kebab-case and variants) → generate API `templateType`. */
const TEMPLATE_QUERY_ALIASES: Record<string, JobHubEmailTemplateType> = {
  'follow-up-no-response': 'follow_up_after_silence',
  'follow-up-after-no-response': 'follow_up_after_silence',
  'follow-up-after-silence': 'follow_up_after_silence',
  'thank-you-after-interview': 'thank_you_post_interview',
  'thank-you-post-interview': 'thank_you_post_interview',
  'salary-negotiation': 'salary_or_offer',
  'salary-offer': 'salary_or_offer',
};

/**
 * Resolves `?template=` from Job Hub deep links (backend today-plan, legacy query strings).
 * Accepts internal snake_case values and common kebab-case aliases.
 */
export function coalesceJobHubEmailTemplateQueryParam(raw: string | null | undefined): JobHubEmailTemplateType | null {
  const s = raw?.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  const aliased = TEMPLATE_QUERY_ALIASES[lower];
  if (aliased) return aliased;
  if (INTERNAL_VALUES.has(s)) return s as JobHubEmailTemplateType;
  const normalizedUnderscore = lower.replace(/-/g, '_');
  if (INTERNAL_VALUES.has(normalizedUnderscore)) return normalizedUnderscore as JobHubEmailTemplateType;
  return null;
}
