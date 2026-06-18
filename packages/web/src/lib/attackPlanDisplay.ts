import { stripAnalysisUserCopy } from '@/lib/jobAnalysisAts';
import { splitFactorListItems } from '@/lib/jobMatchFactorsBreakdown';

/** Interview prep lines — render as prose, not comma-split gap chips. */
export function formatInterviewRiskLine(line: string): string {
  return stripAnalysisUserCopy(line.trim().replace(/^["']|["']$/g, ''));
}

export function isLegacyGapListInterviewRisk(line: string): boolean {
  return /prepare depth on required gaps/i.test(line.trim());
}

export type ParsedAttackPlanLine = {
  headline: string;
  body: string;
  chips: string[];
  tone: 'gap' | 'exposure' | 'pivot' | 'technical' | 'default';
};

function inferTone(headline: string): ParsedAttackPlanLine['tone'] {
  const h = headline.toLowerCase();
  if (h.includes('gap')) return 'gap';
  if (h.includes('exposure')) return 'exposure';
  if (h.includes('pivot') || h.includes('domain')) return 'pivot';
  if (h.includes('technical') || h.includes('depth')) return 'technical';
  return 'default';
}

/** Turn one attack-plan bullet into a scannable headline + optional chips. */
export function parseAttackPlanLine(line: string): ParsedAttackPlanLine {
  const trimmed = line.trim();
  if (!trimmed) {
    return { headline: '', body: '', chips: [], tone: 'default' };
  }

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0 && colonIdx < 90) {
    const headline = trimmed.slice(0, colonIdx).trim();
    const body = trimmed.slice(colonIdx + 1).trim();
    return {
      headline,
      body,
      chips: splitFactorListItems(body),
      tone: inferTone(headline),
    };
  }

  const dashMatch = trimmed.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  if (dashMatch) {
    const headline = dashMatch[1].trim();
    const body = dashMatch[2].trim();
    return {
      headline,
      body,
      chips: splitFactorListItems(body),
      tone: inferTone(headline),
    };
  }

  return {
    headline: '',
    body: trimmed,
    chips: splitFactorListItems(trimmed),
    tone: 'default',
  };
}
