import type { LiveCoachingResponse } from '@/lib/interview-coaching-types';

export type LiveCoachingChip = {
  id: string;
  label: string;
  tone: 'neutral' | 'positive' | 'caution';
};

const ELEMENT_LABELS: Record<string, LiveCoachingChip> = {
  too_short: { id: 'too_short', label: 'Too short', tone: 'caution' },
  missing_structure: { id: 'missing_structure', label: 'Missing structure', tone: 'caution' },
  missing_impact: { id: 'missing_impact', label: 'Add impact', tone: 'caution' },
  missing_action: { id: 'missing_action', label: 'Add what you did', tone: 'caution' },
  missing_example: { id: 'missing_example', label: 'Add example', tone: 'caution' },
  good_pace: { id: 'good_pace', label: 'Good pace', tone: 'positive' },
  good_structure: { id: 'good_structure', label: 'Good structure', tone: 'positive' },
};

export function liveCoachingChips(
  live: LiveCoachingResponse | null | undefined,
  bufferLength: number,
): LiveCoachingChip[] {
  if (!live) return [];

  const chips: LiveCoachingChip[] = [];
  const seen = new Set<string>();

  const push = (chip: LiveCoachingChip) => {
    if (seen.has(chip.id)) return;
    seen.add(chip.id);
    chips.push(chip);
  };

  for (const el of live.missingElements ?? []) {
    const mapped = ELEMENT_LABELS[el];
    if (mapped) push(mapped);
  }

  if (bufferLength > 0 && bufferLength < 80) {
    push(ELEMENT_LABELS.too_short);
  }

  if (live.structureRisk >= 55) {
    push(ELEMENT_LABELS.missing_structure);
  }

  if (live.clarityRisk < 35 && live.structureRisk < 40 && bufferLength >= 120) {
    push(ELEMENT_LABELS.good_pace);
  }

  if (live.structureRisk < 30 && bufferLength >= 100) {
    push(ELEMENT_LABELS.good_structure);
  }

  if (live.missingElements?.includes('missing_example') || live.verbosityRisk >= 60) {
    push(ELEMENT_LABELS.missing_example);
  }

  return chips.slice(0, 3);
}
