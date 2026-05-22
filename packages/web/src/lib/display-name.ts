import type { AuthUser } from './api';

/** Title-case email local part: "john.doe" → "John Doe" */
function formatEmailLocalPart(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Display name for the account — from User.name or email only.
 * Never uses CV content (personal name on a CV is separate from account display name).
 */
export function getDisplayName(user: AuthUser | null | undefined): string {
  if (user?.name?.trim()) return user.name.trim();
  if (user?.email) return formatEmailLocalPart(user.email);
  return 'there';
}

/** Initials for avatar (up to 2 chars). */
export function getDisplayInitials(user: AuthUser | null | undefined): string {
  const name = getDisplayName(user);
  if (name === 'there' || !name.trim()) return 'U';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
