import type { CVProfile } from '@/lib/api';

const SUPPORTED = new Set(['en', 'en-gb', 'de', 'fr', 'es', 'pt-br', 'auto']);

/** Map profile / UI locale to spellcheck API `language` (LanguageTool when configured). */
export function resolveCvSpellcheckLanguage(
  profile?: CVProfile | null,
  fallback?: string | null,
): string {
  const candidates = [
    fallback,
    (profile as { language?: string } | null | undefined)?.language,
    (profile as { locale?: string } | null | undefined)?.locale,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const normalized = raw.trim().toLowerCase().replace('_', '-');
    if (SUPPORTED.has(normalized)) return normalized;
    if (normalized.startsWith('en-')) return 'en-gb';
    if (normalized.startsWith('de')) return 'de';
    if (normalized.startsWith('fr')) return 'fr';
    if (normalized.startsWith('es')) return 'es';
    if (normalized.startsWith('pt')) return 'pt-br';
  }
  return 'en';
}
