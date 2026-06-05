/** Relative timing for hub reminder rows (display only). */
export function hubReminderDueStatus(remindAt: string): 'upcoming' | 'due' | 'elapsed' {
  const t = new Date(remindAt).getTime();
  if (!Number.isFinite(t)) return 'upcoming';
  const now = Date.now();
  if (t > now + 60_000) return 'upcoming';
  if (t > now - 60_000) return 'due';
  return 'elapsed';
}

export function hubReminderStatusLabel(s: ReturnType<typeof hubReminderDueStatus>): string {
  if (s === 'upcoming') return 'Upcoming';
  if (s === 'due') return 'Due';
  return 'Elapsed';
}
