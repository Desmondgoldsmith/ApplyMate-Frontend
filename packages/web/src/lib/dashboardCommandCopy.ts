import type {
  FollowUpIntelligencePayload,
  OpportunityDetectionPayload,
  StrategicRecommendationCategory,
  StrategicRecommendationPayload,
} from '@/lib/today-plan';

/** Coach-style directive from strategic recommendation + rationale heuristics. */
export function directiveFromStrategicRecommendation(data: StrategicRecommendationPayload): string {
  const daysInterview =
    typeof data.rationale?.daysUntilInterview === 'number' && Number.isFinite(data.rationale.daysUntilInterview)
      ? Math.max(0, Math.round(data.rationale.daysUntilInterview))
      : null;
  if (daysInterview != null && daysInterview <= 14) {
    return `You have an interview in ${daysInterview} day${daysInterview === 1 ? '' : 's'}. Focus there today — prep beats new applications right now.`;
  }

  const head = `${data.headline ?? ''} ${data.supporting ?? ''}`.toLowerCase();
  if (head.includes('measurable') && head.includes('bullet')) {
    return 'Your CV is holding back your match scores. 20 minutes in CV Clinic will lift every future application.';
  }
  if (head.includes('review') && head.includes('match')) {
    return 'Fresh roles matched to your profile are waiting. Check what fits before they fill.';
  }

  const cat = data.category as StrategicRecommendationCategory | null;
  if (cat === 'follow_up') {
    return data.headline?.trim() || 'Follow up on applications that are still open — a short message keeps momentum.';
  }

  return (
    data.headline?.trim() ||
    data.supporting?.trim() ||
    'Take the next step that moves your search forward today.'
  );
}

/** Status-style placeholders the API sometimes sends instead of a role or company name. */
function isGarbageFollowUpTarget(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return true;
  if (t === 'this application' || t === 'your application' || t === 'an application') return true;
  if (/application submitted/.test(t) && /\d+\s*days?\s*ago/.test(t)) return true;
  if (/^application submitted(\s+\d+\s*days?\s*ago)?$/.test(t)) return true;
  if (/^submitted\s+\d+\s*days?\s*ago$/.test(t)) return true;
  return false;
}

/**
 * Fixes follow-up lines where “applied to …” used a system label (e.g. “Application submitted 18 days ago”).
 * Safe no-op when the pattern does not match.
 */
export function sanitizeFollowUpDirectiveMessage(message: string): string {
  const raw = message.trim();
  const re =
    /^It's been (\d+)\s+days?\s+since you applied to (.+?)(\.\s+A short follow-up today could revive.*)$/i;
  const m = raw.match(re);
  if (!m) return raw;
  const days = m[1];
  const target = m[2].trim();
  const tail = m[3];
  if (!isGarbageFollowUpTarget(target)) return raw;
  const n = Number(days);
  const dayWord = Number.isFinite(n) && n === 1 ? 'day' : 'days';
  const safeDays = Number.isFinite(n) ? String(Math.max(0, Math.round(n))) : days;
  return `It's been ${safeDays} ${dayWord} since you last applied${tail}`;
}

export function directiveFromOpportunityDetection(data: OpportunityDetectionPayload): string {
  const rawBlob = `${data.headline ?? ''} ${data.supporting ?? ''}`;
  const head = rawBlob.toLowerCase();
  if (head.includes('follow')) {
    const companyRaw = extractCompanyHint(rawBlob);
    const company =
      companyRaw && !isGarbageFollowUpTarget(companyRaw) ? companyRaw : null;
    const days = extractDaysHint(data.supporting ?? data.headline);
    if (days != null && company) {
      return `It's been ${days} days since you applied to ${company}. A short follow-up today could revive this opportunity.`;
    }
    return (
      data.headline?.trim() ||
      "It's been quiet long enough — a polite follow-up may bring your application back into focus."
    );
  }
  return data.headline?.trim() || data.supporting?.trim() || 'There is a strong opportunity in your pipeline worth acting on today.';
}

function extractJobTitleFromFollowUpBlob(blob: string): string | null {
  const b = blob.trim();
  if (!b) return null;
  const patterns: RegExp[] = [
    /\bfor\s+the\s+([^.\n,]{2,80}?)\s+position\b/i,
    /\bfor\s+(?:a|an)\s+([^.\n,]{2,80}?)\s+role\b/i,
    /\b(?:role|position)\s*[:-]\s*([^\n.]{2,80})/i,
  ];
  for (const re of patterns) {
    const m = b.match(re);
    if (m?.[1]) {
      const t = m[1].trim().replace(/\s+/g, ' ');
      if (t.length >= 2 && !isGarbageFollowUpTarget(t)) return t;
    }
  }
  return null;
}

/** Only this stage may use “applied” / “last applied” wording (backend contract). */
export function isFollowUpCoachingSubmitted(stage: string | null | undefined): boolean {
  return (stage ?? '').trim().toLowerCase() === 'submitted';
}

function resolveFollowUpCompanyAndTitle(
  data: FollowUpIntelligencePayload,
  companyHint?: string | null,
): { company: string | null; title: string | null } {
  const blob = `${data.headline ?? ''} ${data.supporting ?? ''}`;
  const fromFields = (s: string | null | undefined) => s?.trim() || '';
  const companyRaw = (
    fromFields(companyHint) ||
    fromFields(data.companyName) ||
    fromFields(extractCompanyHint(blob)) ||
    ''
  ).trim();
  const company = companyRaw && !isGarbageFollowUpTarget(companyRaw) ? companyRaw : null;

  const titleRaw = (
    fromFields(data.jobTitle) ||
    fromFields(extractJobTitleFromFollowUpBlob(blob)) ||
    ''
  ).trim();
  const title = titleRaw && !isGarbageFollowUpTarget(titleRaw) ? titleRaw : null;

  return { company, title };
}

export function directiveFromFollowUpIntelligence(data: FollowUpIntelligencePayload, companyHint?: string | null): string {
  const days =
    typeof data.daysSinceApplication === 'number' && Number.isFinite(data.daysSinceApplication)
      ? Math.max(0, Math.round(data.daysSinceApplication))
      : null;
  if (days != null) {
    const { company, title } = resolveFollowUpCompanyAndTitle(data, companyHint);
    const dayWord = days === 1 ? 'day' : 'days';
    const tail = '. A short follow-up today could revive this opportunity.';
    const submitted = isFollowUpCoachingSubmitted(data.coachingStage);
    if (submitted) {
      if (company && title) {
        return `It's been ${days} ${dayWord} since you last applied to ${company} for the ${title} position${tail}`;
      }
      if (company) {
        return `It's been ${days} ${dayWord} since you last applied to ${company}${tail}`;
      }
      if (title) {
        return `It's been ${days} ${dayWord} since you applied for the ${title} position${tail}`;
      }
      return `It's been ${days} ${dayWord} since you last applied${tail}`;
    }
    if (company && title) {
      return `It's been ${days} ${dayWord} since you've been tracking ${company} for the ${title} role${tail}`;
    }
    if (company) {
      return `It's been ${days} ${dayWord} since ${company} has been on your radar${tail}`;
    }
    if (title) {
      return `It's been ${days} ${dayWord} since you've been working the ${title} opportunity${tail}`;
    }
    return `It's been ${days} ${dayWord} since this follow-up rose on your list${tail}`;
  }
  const head = data.headline?.trim();
  if (head && !isGarbageFollowUpTarget(head)) return head;
  return (
    data.supporting?.trim() ||
    'A short, polite follow-up could bring a quiet application back into focus.'
  );
}

function extractDaysHint(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*days?/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractCompanyHint(blob: string): string | null {
  const applied = blob.match(/applied\s+(?:to|at)\s+([^,.]+)/i);
  if (applied?.[1]) {
    const s = applied[1].trim();
    if (s && !isGarbageFollowUpTarget(s)) return s;
  }
  const toFor = blob.match(/\bto\s+([A-Za-z0-9][A-Za-z0-9&.'\-\s]{1,48}?)\s+for\s+(?:the\s+)?/i);
  if (toFor?.[1]) {
    const s = toFor[1].trim();
    if (s && !isGarbageFollowUpTarget(s)) return s;
  }
  const at = blob.match(/\bat\s+([A-Za-z][A-Za-z0-9&.'\-\s]{1,48})\b/);
  const atS = at?.[1]?.trim();
  if (atS && !isGarbageFollowUpTarget(atS)) return atS;
  return null;
}
