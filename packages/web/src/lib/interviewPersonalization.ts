import type { SkillEvolutionPoint } from '@/lib/interviewAdaptive';
import type {
  DifficultyHint,
  PersonalizationPayload,
  PreviousSessionComparison,
  SkillScores,
  SkillTrend,
} from '@/lib/interview-prep-types';

export const GROWTH_SKILL_KEYS = ['clarity', 'structure', 'depth', 'confidence'] as const;

export type GrowthSkillKey = (typeof GROWTH_SKILL_KEYS)[number];

export function growthSkillLabel(key: string): string {
  const labels: Record<string, string> = {
    clarity: 'Clarity',
    structure: 'Structure',
    depth: 'Depth',
    confidence: 'Confidence',
    relevance: 'Relevance',
  };
  return labels[key] ?? key.replace(/_/g, ' ');
}

export function trendIndicator(trend: SkillTrend | undefined): {
  icon: '↑' | '→' | '↓';
  label: string;
  tone: string;
} {
  switch (trend) {
    case 'improving':
      return { icon: '↑', label: 'Improving', tone: 'ip-trend-up' };
    case 'declining':
      return { icon: '↓', label: 'Declining', tone: 'ip-trend-down' };
    case 'stagnant':
    case 'stable':
    default:
      return { icon: '→', label: 'Stable', tone: 'ip-trend-stable' };
  }
}

/** One highlighted trend — overall session trend preferred. */
export function highlightedTrend(
  improvementTrend?: SkillTrend,
  weaknessTrend?: SkillTrend,
): ReturnType<typeof trendIndicator> {
  return trendIndicator(improvementTrend ?? weaknessTrend ?? 'stable');
}

export function questionStyleBadgeLabel(hint: DifficultyHint | null | undefined): string | null {
  if (!hint) return null;
  const style = (hint.questionStyle ?? '').toLowerCase();
  const level = hint.difficultyLevel;
  if (style.includes('simplified') || style.includes('warm') || level === 'easy') {
    return 'Warm-up question';
  }
  if (style.includes('behavioral') || style.includes('challenge')) {
    return 'Behavioral challenge';
  }
  if (level === 'hard' || style.includes('senior') || style.includes('scenario')) {
    return 'Senior-level scenario';
  }
  if (level === 'medium') return 'Behavioral challenge';
  return null;
}

export function mergeSkillScores(
  fromProfile?: SkillScores | null,
  fromPersonalization?: SkillScores | null,
): SkillScores | null {
  if (fromPersonalization) return fromPersonalization;
  if (fromProfile) return fromProfile;
  return null;
}

export function buildLearningMoments(
  evolution: SkillEvolutionPoint[],
  personalization: PersonalizationPayload | null,
  previousComparison?: PreviousSessionComparison | null,
): string[] {
  const lines: string[] = [];
  if (evolution.length >= 2) {
    const prev = evolution[evolution.length - 2]!;
    const cur = evolution[evolution.length - 1]!;
    if (cur.structure > prev.structure + 4) lines.push('Better structure than last time');
    if (cur.clarity > prev.clarity + 4) lines.push('More clarity than your previous answer');
    const avgPrev = (prev.clarity + prev.structure) / 2;
    const avgCur = (cur.clarity + cur.structure) / 2;
    if (avgCur > avgPrev + 4 && lines.length === 0) {
      lines.push('Clearer delivery than your last response');
    }
  }
  if (previousComparison?.improvedSinceLastSession && previousComparison.improvementInsight?.trim()) {
    lines.push(previousComparison.improvementInsight.trim());
  }
  if (personalization?.weaknessProfile?.trend === 'improving' && lines.length < 2) {
    lines.push('Your focus areas are trending up this session');
  }
  return [...new Set(lines)].slice(0, 2);
}

export function coachHintsFromPersonalization(
  personalization: PersonalizationPayload | null | undefined,
): string[] {
  const nudges = personalization?.realTimeSignals?.nudges?.filter((n) => n?.trim()) ?? [];
  return nudges.slice(0, 2);
}

export function topWeaknessKey(weaknesses: string[] | undefined): GrowthSkillKey | null {
  const raw = weaknesses?.[0]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('clarity') || raw === 'communication') return 'clarity';
  if (raw.includes('structure')) return 'structure';
  if (raw.includes('depth')) return 'depth';
  if (raw.includes('confidence')) return 'confidence';
  return null;
}
