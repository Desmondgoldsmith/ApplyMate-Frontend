/** Semantic outlook bands from `predictiveOutlook` / `dashboardVitals` (not probabilities). */

export type SemanticOutlookBand = 'strong' | 'moderate' | 'building' | 'low';

export type TimelineOutlookBand = 'near-term' | 'medium-term' | 'extended' | 'early-stage';

export type SemanticOutlookPayload = {
  value: SemanticOutlookBand;
  label: string | null;
  outlookBasis: string | null;
  disclaimer: string | null;
};

const SEMANTIC_OUTLOOK_BANDS = new Set<string>(['strong', 'moderate', 'building', 'low']);

const TIMELINE_OUTLOOK_BANDS = new Set<string>([
  'near-term',
  'medium-term',
  'extended',
  'early-stage',
]);

export function isSemanticOutlookBand(raw: string): raw is SemanticOutlookBand {
  return SEMANTIC_OUTLOOK_BANDS.has(raw);
}

export function isTimelineOutlookBand(raw: string): raw is TimelineOutlookBand {
  return TIMELINE_OUTLOOK_BANDS.has(raw);
}

/** Display label for a semantic band (e.g. `strong` → Strong). */
export function formatSemanticOutlookBand(value: SemanticOutlookBand): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Tailwind classes for outlook badge tone. */
export function semanticOutlookBadgeClass(value: SemanticOutlookBand): string {
  switch (value) {
    case 'strong':
      return 'border-[#00C9B1]/48 bg-[#00C9B1]/[0.18] text-[#C6FFF5]';
    case 'moderate':
      return 'border-sky-400/35 bg-sky-500/[0.12] text-sky-100/90';
    case 'building':
      return 'border-amber-400/35 bg-amber-500/[0.12] text-amber-100/88';
    case 'low':
      return 'border-white/16 bg-white/[0.06] text-white/55';
    default:
      return 'border-white/12 bg-white/[0.05] text-white/48';
  }
}

export function semanticOutlookTooltipText(
  outlook: SemanticOutlookPayload | null | undefined,
  fallback: string,
): string {
  const disc = outlook?.disclaimer?.trim();
  if (disc) return disc;
  const basis = outlook?.outlookBasis?.trim();
  if (basis) return basis;
  return fallback;
}

export function formatTimelineOutlookLabel(
  band: TimelineOutlookBand | null,
  label: string | null,
): string | null {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  if (!band) return null;
  if (band === 'near-term') return 'Near-term';
  if (band === 'medium-term') return 'Medium-term';
  if (band === 'extended') return 'Extended';
  if (band === 'early-stage') return 'Early-stage';
  return band;
}
