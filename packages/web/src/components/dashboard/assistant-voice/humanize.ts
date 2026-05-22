/**
 * Defensive display cleanup only — UUID / id-shaped fragments.
 * Product copy and enum→human rewriting live in the backend AssistantCopyService; do not duplicate here.
 */

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function stripTechnicalTokens(text: string): string {
  let t = text.replace(UUID_RE, "").trim();
  t = t.replace(/\b[a-z]+:[a-z0-9-]+\b/gi, "").trim();
  t = t.replace(/\s+/g, " ");
  return t;
}

function titleCaseWords(s: string): string {
  return s
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Last-resort formatting when backend accidentally sends SNAKE_CASE — prefer hiding row over guessing prose.
 */
export function humanizeEnumLabel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const cleaned = stripTechnicalTokens(t);
  if (!cleaned) return null;
  if (/^[A-Z0-9_]+$/.test(cleaned) && cleaned.includes('_')) {
    return titleCaseWords(cleaned.replace(/_/g, ' '));
  }
  if (cleaned.includes('_') && !cleaned.includes(' ')) {
    return titleCaseWords(cleaned.replace(/_/g, ' '));
  }
  return cleaned;
}

/** Pass-through after stripping ids — narrative arc strings are polished server-side. */
export function humanizeNarrativeArc(arc: string | null | undefined): string | null {
  if (!arc?.trim()) return null;
  const cleaned = stripTechnicalTokens(arc.trim());
  return cleaned || null;
}

export function humanizeFatigueLabel(raw: string | null | undefined): string | null {
  return humanizeNarrativeArc(raw);
}

export function humanizeMomentumLabel(raw: string | null | undefined): string | null {
  return humanizeNarrativeArc(raw);
}

export function humanizeConfidenceTrend(raw: string | null | undefined): string | null {
  return humanizeNarrativeArc(raw);
}

/**
 * If text looks like system payload (counts-only, colon-id), return null so caller hides it.
 */
export function shouldHideAsRawMetric(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  const t = text.trim();
  if (UUID_RE.test(t)) return true;
  if (/^\d+\s*\/\s*\d+/.test(t)) return true;
  if (/^[a-z_]+:/i.test(t) && t.length < 80) return true;
  return false;
}

export function humanizeReasoningSignal(signal: string): string {
  return stripTechnicalTokens(signal.trim());
}

/**
 * Lightweight mirror of backend human-copy rules — rejects obvious machine-shaped strings.
 * Use {@link safeHumanText} for display; use this + {@link maybeWarnInvalidHumanExperienceCopy} for QA (dev / flag only).
 */
export function validateHumanExperienceCopy(raw: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const t = raw.trim();
  if (!t) return { ok: true, issues: [] };
  if (UUID_RE.test(t)) issues.push('uuid');
  if (/\b[a-z][a-z0-9_]*:[a-z0-9_-]+\b/i.test(t)) issues.push('colon_id_tail');
  if (/\bPIPELINE_[A-Z0-9_]+\b/.test(t)) issues.push('pipeline_token');
  if (/\bcv_improvement\b/i.test(t)) issues.push('cv_improvement');
  if (/\bworkflow:[a-z0-9_-]+\b/i.test(t)) issues.push('workflow_fragment');
  if (/\brecommendationIntent\b/i.test(t) || /\brecommendation_intent\b/i.test(t)) issues.push('recommendation_intent');
  if (/\brecommendationFamily\b/i.test(t) || /\brecommendation_family\b/i.test(t)) issues.push('recommendation_family');
  if (/^[A-Z][A-Z0-9_]{4,}$/.test(t) && t.includes('_') && !/\s/.test(t)) issues.push('screaming_snake');
  return { ok: issues.length === 0, issues };
}

/** Strip ids then accept only strings that pass {@link validateHumanExperienceCopy}. */
export function safeHumanText(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const cleaned = stripTechnicalTokens(String(raw).trim());
  if (!cleaned) return null;
  return validateHumanExperienceCopy(cleaned).ok ? cleaned : null;
}

/**
 * Dev-only or when `NEXT_PUBLIC_VALIDATE_HUMAN_COPY=1` — logs issues to console; never show to end users.
 */
export function maybeWarnInvalidHumanExperienceCopy(context: string, raw: string | null | undefined): void {
  const enabled =
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VALIDATE_HUMAN_COPY === '1');
  if (!enabled || raw == null || !String(raw).trim()) return;
  const cleaned = stripTechnicalTokens(String(raw).trim());
  if (!cleaned) {
    console.warn(`[ApplyMate human copy] ${context}`, { issue: 'empty_after_strip', preview: String(raw).slice(0, 120) });
    return;
  }
  const v = validateHumanExperienceCopy(cleaned);
  if (!v.ok) console.warn(`[ApplyMate human copy] ${context}`, { issues: v.issues, preview: cleaned.slice(0, 160) });
}
