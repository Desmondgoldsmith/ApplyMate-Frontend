import { describe, expect, it } from 'vitest';

import {
  formatSemanticOutlookBand,
  formatTimelineOutlookLabel,
  isSemanticOutlookBand,
  semanticOutlookBadgeClass,
} from '@/lib/dashboardSemanticOutlook';

describe('dashboardSemanticOutlook', () => {
  it('formats semantic bands for display', () => {
    expect(formatSemanticOutlookBand('strong')).toBe('Strong');
    expect(formatSemanticOutlookBand('building')).toBe('Building');
  });

  it('validates outlook band enum', () => {
    expect(isSemanticOutlookBand('moderate')).toBe(true);
    expect(isSemanticOutlookBand('94')).toBe(false);
  });

  it('prefers timelineOutlookLabel from API', () => {
    expect(formatTimelineOutlookLabel('near-term', 'Near-term')).toBe('Near-term');
    expect(formatTimelineOutlookLabel('extended', null)).toBe('Extended');
  });

  it('assigns tone classes per band', () => {
    expect(semanticOutlookBadgeClass('strong')).toContain('00C9B1');
    expect(semanticOutlookBadgeClass('low')).toContain('white/');
  });
});
