import { getApiErrorMessage } from '@/lib/axios';

/** User-facing copy when email/password login fails. */
export function getLoginErrorMessage(err: unknown): string {
  const msg = getApiErrorMessage(err) || 'Invalid credentials';
  const lower = msg.toLowerCase();
  if (
    lower.includes('not found') ||
    lower.includes('no account') ||
    lower.includes('no user') ||
    lower.includes('does not exist') ||
    lower.includes('unknown user')
  ) {
    return 'We did not find an account with this email. Sign up to create one.';
  }
  if (
    lower.includes('invalid credentials') ||
    lower.includes('incorrect password')
  ) {
    return 'Email or password is incorrect. Try again or sign up if you are new.';
  }
  return msg;
}
