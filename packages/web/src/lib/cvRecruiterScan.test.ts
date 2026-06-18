import { describe, expect, it } from 'vitest';

import type { CVSectionRecord } from '@/lib/api';
import {
  buildRecruiterScanHeatmapByPreviewKey,
  buildRecruiterScanShareSnippet,
  getRecruiterApplyFindingsFromSession,
  normalizeCvRecruiterScanReport,
  normalizeCvRecruiterScanResponse,
  recruiterScanRowIdToPreviewKey,
  recruiterScanSessionFromFindings,
} from '@/lib/cvRecruiterScan';

const SAMPLE_REPORT = {
  firstImpression: {
    verdict: 'mixed',
    headline: 'Credible PM — but the lead is buried',
    narrative: 'Two sentences of gut reaction.',
    sixSecondSnapshot: 'They see State University before your current PM title.',
  },
  readingPath: [
    {
      sectionId: 'exp-row-1',
      sectionType: 'experience',
      label: 'Experience',
      readOrder: 1,
      attentionScore: 92,
      dwellMs: 2400,
      note: 'Eyes jump to most recent title first.',
      focalPoint: 'Product Manager — Acme',
    },
    {
      sectionId: 'edu-row-1',
      sectionType: 'education',
      label: 'Education',
      readOrder: 2,
      attentionScore: 40,
      dwellMs: 800,
      note: 'Scanned quickly.',
    },
  ],
  whatStandsOut: {
    takeaways: ['8 years in B2B SaaS', 'Launched billing v2', 'Cross-functional lead'],
    highlights: [
      {
        text: '40% reduction in churn',
        sectionType: 'experience',
        sectionId: 'exp-row-1',
        why: 'Concrete metric in the first role.',
      },
    ],
  },
  whatCouldBeStronger: {
    concerns: [
      {
        text: 'Education appears above experience',
        severity: 'moderate',
        sectionType: 'education',
        sectionId: 'edu-row-1',
        fix: 'Move education below experience for mid-career signal.',
      },
    ],
    actions: [
      'Reorder sections to lead with summary and current role.',
      'Add one metric to the second bullet under Acme.',
    ],
  },
};

const SECTIONS: CVSectionRecord[] = [
  {
    id: 'exp-row-1',
    type: 'experience',
    data: {},
    order: 1,
  },
  {
    id: 'edu-row-1',
    type: 'education',
    data: {},
    order: 2,
  },
  {
    id: 'custom-abc',
    type: 'custom_publications',
    data: {},
    order: 3,
  },
];

describe('normalizeCvRecruiterScanReport', () => {
  it('parses structured report with exactly 3 takeaways', () => {
    const report = normalizeCvRecruiterScanReport(SAMPLE_REPORT);
    expect(report).not.toBeNull();
    expect(report?.firstImpression.verdict).toBe('mixed');
    expect(report?.firstImpression.sixSecondSnapshot).toContain('State University');
    expect(report?.readingPath).toHaveLength(2);
    expect(report?.readingPath[0]?.readOrder).toBe(1);
    expect(report?.whatStandsOut.takeaways).toHaveLength(3);
    expect(report?.whatCouldBeStronger.concerns[0]?.severity).toBe('moderate');
    expect(report?.whatCouldBeStronger.actions).toHaveLength(2);
  });

  it('pads takeaways to length 3 when fewer provided', () => {
    const report = normalizeCvRecruiterScanReport({
      ...SAMPLE_REPORT,
      whatStandsOut: { takeaways: ['Only one'], highlights: [] },
    });
    expect(report?.whatStandsOut.takeaways).toEqual(['Only one', '', '']);
  });
});

describe('normalizeCvRecruiterScanResponse', () => {
  it('parses clarify response', () => {
    const res = normalizeCvRecruiterScanResponse({
      type: 'clarify',
      question: 'Which role?',
      commandId: 'cmd-1',
      scanId: 'scan-1',
    });
    expect(res.type).toBe('clarify');
    if (res.type !== 'clarify') throw new Error('expected clarify');
    expect(res.question).toBe('Which role?');
  });

  it('parses result response with legacy arrays', () => {
    const res = normalizeCvRecruiterScanResponse({
      type: 'result',
      scope: 'recruiter_scan',
      commandId: 'cmd-2',
      scanId: 'scan-2',
      report: SAMPLE_REPORT,
      improvementFindings: ['Legacy finding'],
      diff: { summary: 'Recruiter scan complete.' },
    });
    expect(res.type).toBe('result');
    if (res.type !== 'result') throw new Error('expected result');
    expect(res.report.firstImpression.headline).toContain('Credible PM');
    expect(res.improvementFindings).toEqual(['Legacy finding']);
    expect(res.diffSummary).toBe('Recruiter scan complete.');
  });
});

describe('recruiterScanRowIdToPreviewKey', () => {
  it('maps core section types to fixed preview keys', () => {
    expect(recruiterScanRowIdToPreviewKey('experience', SECTIONS)).toBe('experience');
    expect(recruiterScanRowIdToPreviewKey('summary', SECTIONS)).toBe('summary');
  });

  it('maps custom section row UUID to parsed-{id}', () => {
    expect(recruiterScanRowIdToPreviewKey('custom-abc', SECTIONS)).toBe(
      'parsed-custom-abc',
    );
  });
});

describe('buildRecruiterScanHeatmapByPreviewKey', () => {
  it('binds reading path entries by preview section id', () => {
    const report = normalizeCvRecruiterScanReport(SAMPLE_REPORT)!;
    const map = buildRecruiterScanHeatmapByPreviewKey(report, SECTIONS);
    expect(map.experience?.attentionScore).toBe(92);
    expect(map['parsed-custom-abc']).toBeUndefined();
    expect(map.education?.attentionScore).toBe(40);
  });
});

describe('recruiterScanSessionFromFindings', () => {
  it('returns null when report is missing', () => {
    expect(
      recruiterScanSessionFromFindings({
        type: 'result',
        scope: 'findings',
        affectedScopeLabel: 'Findings only',
        operation: 'recruiter_scan',
        commandId: 'cmd-1',
        findings: ['Only legacy'],
        diff: { summary: '' },
      }),
    ).toBeNull();
  });

  it('builds session when report is present', () => {
    const report = normalizeCvRecruiterScanReport(SAMPLE_REPORT)!;
    const session = recruiterScanSessionFromFindings({
      type: 'result',
      scope: 'findings',
      affectedScopeLabel: 'Findings only',
      operation: 'recruiter_scan',
      commandId: 'cmd-3',
      findings: [],
      report,
      diff: { summary: 'Done' },
    });
    expect(session?.commandId).toBe('cmd-3');
    expect(session?.report.firstImpression.verdict).toBe('mixed');
  });
});

describe('getRecruiterApplyFindingsFromSession', () => {
  it('prefers report actions over legacy improvementFindings', () => {
    const report = normalizeCvRecruiterScanReport(SAMPLE_REPORT)!;
    const findings = getRecruiterApplyFindingsFromSession({
      commandId: 'cmd-4',
      report,
      improvementFindings: ['Legacy only'],
    });
    expect(findings[0]).toContain('Reorder sections');
  });
});

describe('buildRecruiterScanShareSnippet', () => {
  it('includes verdict, headline, takeaway, and concern', () => {
    const report = normalizeCvRecruiterScanReport(SAMPLE_REPORT)!;
    const snippet = buildRecruiterScanShareSnippet({
      commandId: 'cmd-5',
      report,
    });
    expect(snippet).toContain('mixed');
    expect(snippet).toContain('Credible PM');
    expect(snippet).toContain('8 years in B2B SaaS');
    expect(snippet).toContain('Education appears above experience');
  });
});
