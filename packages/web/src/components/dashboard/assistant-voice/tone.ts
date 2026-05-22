/**
 * High-level emotional register for layout + motion — not user-visible labels.
 */

export type AssistantTone = 'calm' | 'focused' | 'gentle' | 'energized';

export function assistantToneFromMode(mode: string | null): AssistantTone {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('RECOVERY')) return 'gentle';
  if (m.includes('INTERVIEW')) return 'focused';
  if (m.includes('SPRINT') || m.includes('APPLICATION')) return 'energized';
  return 'calm';
}
