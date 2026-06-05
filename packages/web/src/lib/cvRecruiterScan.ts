import type { CSSProperties } from 'react';

import type { CVSectionRecord } from '@/lib/api';
import type { CvGlobalAssistantFindingsResult } from '@/lib/cvGlobalAssistant';
import { getRecruiterImprovementFindingsForApply } from '@/lib/cvGlobalAssistant';

export type CvRecruiterScanVerdict = 'strong' | 'mixed' | 'weak';

export type CvRecruiterScanConcernSeverity = 'minor' | 'moderate' | 'critical';

export type CvRecruiterScanReadingPathEntry = {
  sectionId: string;
  sectionType: string;
  label: string;
  readOrder: number;
  attentionScore: number;
  dwellMs: number;
  note: string;
  focalPoint?: string;
};

export type CvRecruiterScanHighlight = {
  text: string;
  sectionType?: string;
  sectionId?: string;
  why?: string;
};

export type CvRecruiterScanConcern = {
  text: string;
  severity: CvRecruiterScanConcernSeverity;
  sectionType?: string;
  sectionId?: string;
  fix?: string;
};

export type CvRecruiterScanReport = {
  firstImpression: {
    verdict: CvRecruiterScanVerdict;
    headline: string;
    narrative: string;
    sixSecondSnapshot: string;
  };
  readingPath: CvRecruiterScanReadingPathEntry[];
  whatStandsOut: {
    takeaways: string[];
    highlights: CvRecruiterScanHighlight[];
  };
  whatCouldBeStronger: {
    concerns: CvRecruiterScanConcern[];
    actions: string[];
  };
};

/** Unified session for Clinic + Global Assistant recruiter scan UI. */
export type CvRecruiterScanSession = {
  commandId: string;
  scanId?: string;
  report: CvRecruiterScanReport;
  positiveFindings?: string[];
  improvementFindings?: string[];
  actionableFindings?: string[];
  findings?: string[];
  diffSummary?: string;
};

export type CvRecruiterScanClarifyResponse = {
  type: 'clarify';
  question: string;
  commandId: string;
  scanId?: string;
};

export type CvRecruiterScanResultResponse = CvRecruiterScanSession & {
  type: 'result';
  scope: 'recruiter_scan' | 'findings';
  diffSummary?: string;
};

export type CvRecruiterScanResponse =
  | CvRecruiterScanClarifyResponse
  | CvRecruiterScanResultResponse;

const FIXED_PREVIEW_KEYS = new Set([
  'personal',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'achievements',
  'languages',
  'references',
]);

function parseVerdict(raw: unknown): CvRecruiterScanVerdict {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'strong' || v === 'mixed' || v === 'weak') return v;
  return 'mixed';
}

function parseSeverity(raw: unknown): CvRecruiterScanConcernSeverity {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'minor' || s === 'moderate' || s === 'critical') return s;
  return 'moderate';
}

function parseReadingPath(raw: unknown): CvRecruiterScanReadingPathEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CvRecruiterScanReadingPathEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const sectionId = String(o.sectionId ?? o.section_id ?? '').trim();
    if (!sectionId) continue;
    out.push({
      sectionId,
      sectionType: String(o.sectionType ?? o.section_type ?? '').trim(),
      label: String(o.label ?? '').trim() || 'Section',
      readOrder: typeof o.readOrder === 'number' ? o.readOrder : typeof o.read_order === 'number' ? o.read_order : out.length + 1,
      attentionScore: typeof o.attentionScore === 'number' ? o.attentionScore : typeof o.attention_score === 'number' ? o.attention_score : 50,
      dwellMs: typeof o.dwellMs === 'number' ? o.dwellMs : typeof o.dwell_ms === 'number' ? o.dwell_ms : 0,
      note: String(o.note ?? '').trim(),
      focalPoint: String(o.focalPoint ?? o.focal_point ?? '').trim() || undefined,
    });
  }
  return out.sort((a, b) => a.readOrder - b.readOrder);
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export function normalizeCvRecruiterScanReport(raw: unknown): CvRecruiterScanReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const fi = r.firstImpression ?? r.first_impression;
  const fiObj =
    fi && typeof fi === 'object' && !Array.isArray(fi) ? (fi as Record<string, unknown>) : {};
  const wso = r.whatStandsOut ?? r.what_stands_out;
  const wsoObj =
    wso && typeof wso === 'object' && !Array.isArray(wso) ? (wso as Record<string, unknown>) : {};
  const wcs = r.whatCouldBeStronger ?? r.what_could_be_stronger;
  const wcsObj =
    wcs && typeof wcs === 'object' && !Array.isArray(wcs) ? (wcs as Record<string, unknown>) : {};

  const takeaways = parseStringArray(wsoObj.takeaways).slice(0, 3);
  while (takeaways.length < 3) takeaways.push('');

  const highlightsRaw = Array.isArray(wsoObj.highlights) ? wsoObj.highlights : [];
  const highlights: CvRecruiterScanHighlight[] = [];
  for (const h of highlightsRaw) {
    if (!h || typeof h !== 'object' || Array.isArray(h)) continue;
    const o = h as Record<string, unknown>;
    const text = String(o.text ?? '').trim();
    if (!text) continue;
    highlights.push({
      text,
      sectionType: String(o.sectionType ?? o.section_type ?? '').trim() || undefined,
      sectionId: String(o.sectionId ?? o.section_id ?? '').trim() || undefined,
      why: String(o.why ?? '').trim() || undefined,
    });
  }

  const concernsRaw = Array.isArray(wcsObj.concerns) ? wcsObj.concerns : [];
  const concerns: CvRecruiterScanConcern[] = [];
  for (const c of concernsRaw) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    const o = c as Record<string, unknown>;
    const text = String(o.text ?? '').trim();
    if (!text) continue;
    concerns.push({
      text,
      severity: parseSeverity(o.severity),
      sectionType: String(o.sectionType ?? o.section_type ?? '').trim() || undefined,
      sectionId: String(o.sectionId ?? o.section_id ?? '').trim() || undefined,
      fix: String(o.fix ?? '').trim() || undefined,
    });
  }

  return {
    firstImpression: {
      verdict: parseVerdict(fiObj.verdict),
      headline: String(fiObj.headline ?? '').trim() || 'First impression',
      narrative: String(fiObj.narrative ?? '').trim(),
      sixSecondSnapshot: String(fiObj.sixSecondSnapshot ?? fiObj.six_second_snapshot ?? '').trim(),
    },
    readingPath: parseReadingPath(r.readingPath ?? r.reading_path),
    whatStandsOut: { takeaways, highlights },
    whatCouldBeStronger: {
      concerns,
      actions: parseStringArray(wcsObj.actions),
    },
  };
}

export function normalizeCvRecruiterScanResponse(raw: unknown): CvRecruiterScanResponse {
  const body =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (body.type === 'clarify') {
    return {
      type: 'clarify',
      question: String(body.question ?? 'Which role should I simulate the recruiter for?'),
      commandId: String(body.commandId ?? body.command_id ?? ''),
      scanId: String(body.scanId ?? body.scan_id ?? '').trim() || undefined,
    };
  }

  const report = normalizeCvRecruiterScanReport(body.report);
  if (!report) {
    throw new Error('Recruiter scan response missing report');
  }

  const diffRaw = body.diff;
  const diffSummary =
    diffRaw && typeof diffRaw === 'object' && !Array.isArray(diffRaw)
      ? String((diffRaw as Record<string, unknown>).summary ?? '')
      : '';

  return {
    type: 'result',
    scope: String(body.scope ?? '').trim() === 'findings' ? 'findings' : 'recruiter_scan',
    commandId: String(body.commandId ?? body.command_id ?? ''),
    scanId: String(body.scanId ?? body.scan_id ?? '').trim() || undefined,
    report,
    positiveFindings: parseStringArray(body.positiveFindings ?? body.positive_findings),
    improvementFindings: parseStringArray(body.improvementFindings ?? body.improvement_findings),
    actionableFindings: parseStringArray(body.actionableFindings ?? body.actionable_findings),
    findings: parseStringArray(body.findings),
    diffSummary: diffSummary || undefined,
  };
}

/** Build session from global assistant findings response when `report` is present. */
export function recruiterScanSessionFromFindings(
  res: CvGlobalAssistantFindingsResult & { report?: CvRecruiterScanReport | null },
): CvRecruiterScanSession | null {
  if (!res.report) return null;
  return {
    commandId: res.commandId,
    report: res.report,
    positiveFindings: res.positiveFindings,
    improvementFindings: res.improvementFindings,
    actionableFindings: res.actionableFindings,
    findings: res.findings,
    diffSummary: res.diff?.summary,
  };
}

/** Map API section row UUID → CV preview `data-cv-section` id. */
export function recruiterScanRowIdToPreviewKey(
  sectionRowId: string,
  sections: CVSectionRecord[],
): string {
  const id = sectionRowId.trim();
  if (!id) return 'summary';
  if (FIXED_PREVIEW_KEYS.has(id)) return id;

  const row = sections.find((s) => s.id === id);
  if (!row) return id;

  const tl = row.type.toLowerCase();
  if (tl.startsWith('custom_')) return `parsed-${row.id}`;
  if (tl === 'custom') return 'custom-legacy';
  if (tl === 'links') return 'personal';
  if (FIXED_PREVIEW_KEYS.has(tl)) return tl;
  return `parsed-${row.id}`;
}

export function buildRecruiterScanHeatmapByPreviewKey(
  report: CvRecruiterScanReport,
  sections: CVSectionRecord[],
): Record<string, CvRecruiterScanReadingPathEntry> {
  const map: Record<string, CvRecruiterScanReadingPathEntry> = {};
  for (const entry of report.readingPath) {
    const previewKey = recruiterScanRowIdToPreviewKey(entry.sectionId, sections);
    map[previewKey] = { ...entry, label: entry.label || previewKey };
  }
  return map;
}

export function recruiterScanHeatmapStyle(
  entry: CvRecruiterScanReadingPathEntry | undefined,
): CSSProperties {
  if (!entry) {
    return { opacity: 0.55 };
  }
  const intensity = Math.max(0, Math.min(100, entry.attentionScore)) / 100;
  return {
    boxShadow: `inset 0 0 0 2px rgba(234, 88, 12, ${0.15 + intensity * 0.55})`,
    background: `linear-gradient(90deg, rgba(251, 146, 60, ${intensity * 0.14}) 0%, transparent 72%)`,
  };
}

export function getRecruiterApplyFindingsFromSession(session: CvRecruiterScanSession): string[] {
  const fromReport = session.report.whatCouldBeStronger.actions.filter(Boolean);
  if (fromReport.length > 0) return fromReport;
  const legacy: CvGlobalAssistantFindingsResult = {
    type: 'result',
    scope: 'findings',
    affectedScopeLabel: 'Findings only',
    operation: 'recruiter_scan',
    commandId: session.commandId,
    findings: session.findings ?? [],
    positiveFindings: session.positiveFindings,
    improvementFindings: session.improvementFindings,
    actionableFindings: session.actionableFindings,
    diff: { summary: session.diffSummary ?? '' },
  };
  return getRecruiterImprovementFindingsForApply(legacy);
}

export function buildRecruiterScanShareSnippet(session: CvRecruiterScanSession): string {
  const { verdict, headline } = session.report.firstImpression;
  const takeaway = session.report.whatStandsOut.takeaways.find((t) => t.trim()) ?? '';
  const concern = session.report.whatCouldBeStronger.concerns[0]?.text ?? '';
  const lines = [
    `Recruiter Scan on ApplyMate (${verdict}): ${headline}`,
    takeaway ? `They'd remember: ${takeaway}` : '',
    concern ? `Concern: ${concern}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}
