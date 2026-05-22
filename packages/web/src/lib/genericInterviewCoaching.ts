import type { FocusItem } from '@/lib/dashboardFocusMerge';

/**
 * Backend suppresses generic interview cards when upcoming interviews exist; this filters stale/feeds
 * that still surface legacy “Highest Impact Preparation” / “Prepare for interviews” copy.
 */
export function isGenericInterviewCoachingCopy(title: string, subtitle?: string): boolean {
  const h = title.trim();
  const blob = `${title}\n${subtitle ?? ''}`.toLowerCase();
  if (/highest\s+impact\s+preparation/i.test(h)) return true;
  if (/prepare\s+for\s+interviews/i.test(h)) return true;
  if (/prepare\s+for\s+interviews/i.test(blob)) return true;
  if (/you\s+have\s+active\s+interviews\s+in\s+progress/i.test(blob)) return true;
  if (/active\s+interviews\s+in\s+progress/i.test(blob)) return true;
  return false;
}

/** When {@link upcomingInterviewRowCount} &gt; 0, drops matching Focus rows (Phase 15 + merged sources). */
export function filterFocusItemsRemovingGenericInterviewCoaching(
  items: FocusItem[],
  upcomingInterviewRowCount: number,
): FocusItem[] {
  if (upcomingInterviewRowCount <= 0) return items;
  return items.filter((it) => !isGenericInterviewCoachingCopy(it.title, it.subtitle));
}
