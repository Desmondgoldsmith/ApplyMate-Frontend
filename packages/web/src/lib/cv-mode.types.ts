/** Session/UI mode for the shared CV builder — not persisted in DB. */
export type CvMode = 'clinic' | 'tailor';

export function parseCvMode(raw: string | null | undefined): CvMode {
  return raw?.trim().toLowerCase() === 'tailor' ? 'tailor' : 'clinic';
}
