import { describe, expect, it } from 'vitest';

import {
  buildApplyRecruiterFindingsPayload,
  getRecruiterImprovementFindingsForApply,
  globalAssistantChangedFields,
  mergeGlobalAssistantPatches,
  partitionRecruiterScanFindings,
  normalizeCvGlobalAssistantCommandResponse,
  normalizeCvGlobalAssistantOperation,
  normalizeCvGlobalAssistantOperations,
} from '@/lib/cvGlobalAssistant';

describe('normalizeCvGlobalAssistantOperation', () => {
  it('parses catalog rows', () => {
    const op = normalizeCvGlobalAssistantOperation({
      operation: 'recruiter_scan',
      label: 'Recruiter scan',
      description: 'Scan for issues',
      exampleCommand: 'Run a recruiter scan',
      affectedScopeLabel: 'Findings only',
      scope: 'findings',
    });
    expect(op?.operation).toBe('recruiter_scan');
    expect(op?.affectedScopeLabel).toBe('Findings only');
    expect(op?.scope).toBe('findings');
  });
});

describe('normalizeCvGlobalAssistantCommandResponse', () => {
  it('parses full_cv result with sectionDiffs', () => {
    const res = normalizeCvGlobalAssistantCommandResponse({
      type: 'result',
      scope: 'full_cv',
      affectedScopeLabel: 'Entire CV',
      operation: 'rewrite_action_verbs',
      commandId: 'cmd-1',
      patch: { experience: { items: [] } },
      sectionDiffs: [
        {
          targetSection: 'experience',
          patch: { experience: { items: [{ title: 'Dev' }] } },
          diff: {
            before: { experience: {} },
            after: { experience: { items: [{ title: 'Dev' }] } },
            summary: 'Updated verbs',
          },
        },
      ],
      diff: { summary: 'Overall' },
    });
    expect(res.type).toBe('result');
    if (res.type !== 'result' || res.scope !== 'full_cv') throw new Error('expected full_cv');
    expect(res.sectionDiffs).toHaveLength(1);
    expect(res.sectionDiffs[0]?.targetSection).toBe('experience');
  });

  it('parses findings result', () => {
    const res = normalizeCvGlobalAssistantCommandResponse({
      type: 'result',
      scope: 'findings',
      operation: 'recruiter_scan',
      commandId: 'cmd-2',
      findings: ['Weak summary'],
      diff: { summary: 'Scan complete' },
    });
    if (res.type !== 'result' || res.scope !== 'findings') throw new Error('expected findings');
    expect(res.findings).toEqual(['Weak summary']);
  });

  it('parses comprehensive recruiter scan report on findings scope', () => {
    const res = normalizeCvGlobalAssistantCommandResponse({
      type: 'result',
      scope: 'findings',
      operation: 'recruiter_scan',
      commandId: 'cmd-report',
      scanId: 'scan-1',
      findings: ['Legacy'],
      report: {
        firstImpression: {
          verdict: 'strong',
          headline: 'Clear senior profile',
          narrative: 'Reads well.',
          sixSecondSnapshot: 'Title and company pop immediately.',
        },
        readingPath: [],
        whatStandsOut: { takeaways: ['A', 'B', 'C'], highlights: [] },
        whatCouldBeStronger: { concerns: [], actions: ['Add metrics'] },
      },
      diff: { summary: 'Scan complete' },
    });
    if (res.type !== 'result' || res.scope !== 'findings') throw new Error('expected findings');
    expect(res.report?.firstImpression.verdict).toBe('strong');
    expect(res.scanId).toBe('scan-1');
  });
});

describe('mergeGlobalAssistantPatches', () => {
  it('merges only accepted section patches', () => {
    const merged = mergeGlobalAssistantPatches(
      [
        {
          targetSection: 'summary',
          patch: { summary: { text: 'A' } },
          diff: { before: null, after: null, summary: '' },
        },
        {
          targetSection: 'experience',
          patch: { experience: { items: [] } },
          diff: { before: null, after: null, summary: '' },
        },
      ],
      ['experience'],
    );
    expect(merged).toEqual({ experience: { items: [] } });
  });
});

describe('globalAssistantChangedFields', () => {
  it('formats section diffs when before/after are full CV blobs', () => {
    const fullCvBefore = {
      summary: { text: 'Old' },
      experience: {
        items: [{ title: 'Dev', company: 'Co', bullets: ['Before bullet'] }],
      },
    };
    const fullCvAfter = {
      summary: { text: 'New' },
      experience: {
        items: [{ title: 'Dev', company: 'Co', bullets: ['After bullet'] }],
      },
    };
    const fields = globalAssistantChangedFields([
      {
        targetSection: 'experience',
        patch: { experience: fullCvAfter.experience },
        diff: {
          before: fullCvBefore,
          after: fullCvAfter,
          summary: 'Updated experience',
        },
      },
    ]);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.before).toContain('Before bullet');
    expect(fields[0]?.after).toContain('After bullet');
  });

  it('builds one changed field per section', () => {
    const fields = globalAssistantChangedFields([
      {
        targetSection: 'skills',
        patch: {},
        diff: {
          before: { skills: { items: ['a'] } },
          after: { skills: { items: ['b'] } },
          summary: 'Skills refresh',
        },
      },
    ]);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.fieldPath).toBe('skills');
    expect(fields[0]?.fieldLabel).toBe('Skills refresh');
    expect(fields[0]?.sectionDiffIndex).toBe(0);
  });
});

describe('partitionRecruiterScanFindings', () => {
  it('keeps positives separate from actionable when API groups findings', () => {
    const part = partitionRecruiterScanFindings({
      findings: ['POSITIVE: Strong summary', 'ACTION: Add metrics'],
      positiveFindings: ['Strong summary'],
      improvementFindings: ['Add metrics'],
      actionableFindings: [],
      uncategorizedFindings: [],
    });
    expect(part.positives).toEqual(['Strong summary']);
    expect(part.actionable).toEqual(['Add metrics']);
    expect(part.hasActionableFindings).toBe(true);
  });

  it('does not treat uncategorized API notes as actionable', () => {
    const part = partitionRecruiterScanFindings({
      findings: [],
      positiveFindings: ['Good layout'],
      improvementFindings: [],
      actionableFindings: [],
      uncategorizedFindings: ['Neutral observation'],
    });
    expect(part.hasActionableFindings).toBe(false);
    expect(part.otherNotes).toEqual(['Neutral observation']);
  });

  it('derives buckets from POSITIVE/ACTION prefixes when groups are missing', () => {
    const part = partitionRecruiterScanFindings({
      findings: ['POSITIVE: Clear headline', 'ACTION: Shorten summary'],
      positiveFindings: [],
      improvementFindings: [],
      actionableFindings: [],
      uncategorizedFindings: [],
    });
    expect(part.positives).toEqual(['Clear headline']);
    expect(part.actionable).toEqual(['Shorten summary']);
  });
});

describe('getRecruiterImprovementFindingsForApply', () => {
  it('prefers improvementFindings over raw findings list', () => {
    const lines = getRecruiterImprovementFindingsForApply({
      findings: ['POSITIVE: Good', 'ACTION: Add metrics'],
      improvementFindings: ['Tighten experience bullets'],
      actionableFindings: [],
      positiveFindings: ['Good'],
      uncategorizedFindings: [],
    });
    expect(lines).toEqual(['Tighten experience bullets']);
  });
});

describe('buildApplyRecruiterFindingsPayload', () => {
  it('uses apply_recruiter_findings with findings and scan command id', () => {
    const payload = buildApplyRecruiterFindingsPayload(
      ['Add metrics', 'Shorten summary'],
      'scan-cmd-1',
    );
    expect(payload.operation).toBe('apply_recruiter_findings');
    expect(payload.findings).toEqual(['Add metrics', 'Shorten summary']);
    expect(payload.scanCommandId).toBe('scan-cmd-1');
    expect(payload.command).toContain('Add metrics');
  });
});

describe('normalizeCvGlobalAssistantOperations', () => {
  it('reads operations array from envelope', () => {
    const ops = normalizeCvGlobalAssistantOperations({
      operations: [
        {
          operation: 'add_metrics',
          label: 'Add metrics',
          description: '',
          exampleCommand: 'Add metrics',
          affectedScopeLabel: 'Entire CV',
          scope: 'full_cv',
        },
      ],
    });
    expect(ops).toHaveLength(1);
    expect(ops[0]?.operation).toBe('add_metrics');
  });
});
