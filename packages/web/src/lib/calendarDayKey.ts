/** Calendar day in `YYYY-MM-DD` for a given IANA zone (matches backend “local day” semantics). */
export function formatCalendarDayKeyInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
