/** User-facing copy for the dedicated follow-up queue page (ApplyMate dark / teal). */

export const FOLLOW_UP_PAGE = {
  title: 'Follow-up queue',
  subtitle:
    'Roles that need a nudge—sorted so you can clear them in order. Open each row to continue on the board, in Job Hub, or wherever that job lives.',
  emptyTitle: 'You are caught up',
  emptyBody:
    'Nothing is queued for follow-up right now. Check your dashboard for new signals, or browse Job Hub when you are ready to add more.',
  searchPlaceholder: 'Search company, title, or notes…',
  showingRange: (from: number, to: number, total: number) =>
    `Showing ${from}–${to} of ${total} in this list`,
  showingFiltered: (shown: number, totalLoaded: number) =>
    `${shown} match${shown === 1 ? '' : 'es'} of ${totalLoaded} loaded`,
  capNote: (loaded: number, serverTotal: number) =>
    `Showing ${loaded} of ${serverTotal} follow-ups. Load more by increasing the list cap or clearing completed items.`,
  cardsLabel: 'Cards',
  tableLabel: 'Table',
  prev: 'Previous',
  next: 'Next',
  pageStatus: (page: number, totalPages: number) => `Page ${page} of ${totalPages}`,
  openAction: 'Open',
  noLink: 'No link',
  typeColumn: 'Type',
  roleColumn: 'Role',
  sourceColumn: 'Source',
  actionColumn: 'Action',
} as const;
