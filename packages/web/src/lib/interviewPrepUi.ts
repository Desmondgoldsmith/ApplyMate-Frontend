/** Interview Prep UI class tokens — visual layer only (pairs with interview-prep.css) */

export const ipText = {
  primary: 'text-[var(--text-primary)]',
  secondary: 'text-[var(--text-secondary)]',
  muted: 'text-[var(--text-muted)]',
  teal: 'text-[var(--text-teal)]',
} as const;

export const ipLayout = {
  page: 'ip-page mx-auto w-full max-w-3xl space-y-0',
  pageWide: 'ip-page relative mx-auto flex w-full max-w-6xl min-h-[min(560px,calc(100dvh-6.5rem))] max-h-[calc(100dvh-4.5rem)] flex-col ip-session-shell overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]',
} as const;
