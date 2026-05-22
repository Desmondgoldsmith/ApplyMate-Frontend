/**
 * Recovery vs encouragement flavor — used by reassurance picker + future surfaces.
 * Copy stays short; deterministic pools live in `reassurance.ts`.
 */

export type RecoveryEncouragementKind = 'recovery' | 'encouragement' | 'neutral';

export function recoveryEncouragementKind(mode: string | null): RecoveryEncouragementKind {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('RECOVERY')) return 'recovery';
  if (m.includes('ENCOURAG') || m.includes('CELEBRAT')) return 'encouragement';
  return 'neutral';
}
