export type PresentationGapAdviceType = 'use_in_bullets' | 'soft_context';

export type PresentationGap = {
  skill: string;
  adviceType: PresentationGapAdviceType;
  guidance: string;
};

const ADVICE_TYPES = new Set<PresentationGapAdviceType>(['use_in_bullets', 'soft_context']);

function parseAdviceType(raw: unknown): PresentationGapAdviceType {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (ADVICE_TYPES.has(s as PresentationGapAdviceType)) {
    return s as PresentationGapAdviceType;
  }
  return 'use_in_bullets';
}

/** Descriptor / soft gaps — weave into bullets, not skills list (GET /jobs/:id, analyze). */
export function parsePresentationGaps(raw: unknown): PresentationGap[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const items: PresentationGap[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const skill =
      (typeof o.skill === 'string' && o.skill.trim()) ||
      (typeof o.name === 'string' && o.name.trim()) ||
      '';
    const guidance =
      (typeof o.guidance === 'string' && o.guidance.trim()) ||
      (typeof o.detail === 'string' && o.detail.trim()) ||
      (typeof o.advice === 'string' && o.advice.trim()) ||
      '';
    if (!skill || !guidance) continue;
    items.push({
      skill,
      adviceType: parseAdviceType(o.adviceType ?? o.advice_type),
      guidance,
    });
  }
  return items.length > 0 ? items : undefined;
}

export const PRESENTATION_GAPS_SECTION_TITLE = 'Use in your experience bullets';

export function presentationGapAdviceLabel(type: PresentationGapAdviceType): string {
  return type === 'soft_context' ? 'Mention in summary or bullets' : 'Weave into a bullet';
}
