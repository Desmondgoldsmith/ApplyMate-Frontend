import { stripTechnicalTokens } from '@/components/dashboard/assistant-voice/humanize';

/**
 * Legacy helper — only pass backend-polished arc copy; no client-side enum → prose mapping.
 */
export function composeArcPresenceLine(params: {
  narrativeArc: string | null;
  daysInArc: number | null;
}): string | null {
  const arcVoice = stripTechnicalTokens(params.narrativeArc?.trim() ?? '');
  const day =
    typeof params.daysInArc === 'number' && Number.isFinite(params.daysInArc)
      ? Math.max(1, Math.round(params.daysInArc))
      : null;

  if (arcVoice && day != null) {
    return `${arcVoice} You’ve been in this chapter for ${day} day${day === 1 ? '' : 's'}.`;
  }
  if (arcVoice) return arcVoice;
  return null;
}

/**
 * Do not synthesize user-visible copy from raw assistantState enums — backend owns language.
 */
export function composeInternalStateWhisper(_params: {
  momentumState: string | null;
  fatigueLevel: string | null;
  confidenceTrend: string | null;
}): string | null {
  return null;
}

/**
 * Single calm explanation under the hero headline — merges subtitle + arc + continuity without stacking boxes.
 */
export function composeHeroSecondary(params: {
  subtitle: string | null;
  arcLabel: string | null;
  continuityLine: string | null;
}): string | null {
  const sub = stripTechnicalTokens(params.subtitle?.trim() ?? "") || null;
  const arc = params.arcLabel?.trim() ? stripTechnicalTokens(params.arcLabel.trim()) || null : null;
  const cont = stripTechnicalTokens(params.continuityLine?.trim() ?? "") || null;

  const seen = new Set<string>();
  const parts: string[] = [];
  const push = (s: string | null) => {
    const t = s?.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    parts.push(t);
  };

  push(sub);
  if (arc && (!sub || arc.toLowerCase() !== sub.toLowerCase())) push(arc);
  if (cont && (!sub || cont.toLowerCase() !== sub.toLowerCase())) push(cont);

  if (parts.length === 0) return null;
  return parts.slice(0, 2).join(" ");
}
