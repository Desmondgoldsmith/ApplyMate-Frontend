/**
 * Human-facing insight labels — answer “why does this matter to me?” not system taxonomy.
 */

export function insightKindLabel(category: string | null, insightCategory: string | null): string | null {
  const k = `${insightCategory ?? ''} ${category ?? ''}`.toLowerCase();
  if (k.includes('coach')) return 'Guidance';
  if (k.includes('analytic') || k === 'pipeline') return 'Your landscape';
  if (k.includes('encourag')) return 'Encouragement';
  if (k.includes('momentum') || k.includes('direction')) return 'Forward motion';
  if (k.includes('recovery') || k.includes('fatigue') || k.includes('burnout')) return 'Taking care';
  return null;
}
