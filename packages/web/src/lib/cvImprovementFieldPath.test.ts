import { describe, expect, it } from 'vitest';

import { emptyCVBuilderData } from '@/lib/cvBuilder';
import {
  isCvImprovementAiFixable,
  canShowCvImprovementFixWithAI,
  parseCvImprovementTargetFieldPath,
  resolveImprovementJumpTarget,
} from '@/lib/cvImprovementFieldPath';

describe('cvImprovementFieldPath', () => {
  it('parses experience bullet paths', () => {
    expect(parseCvImprovementTargetFieldPath('experience[0].bullets[1]')).toEqual({
      sectionRoot: 'experience',
      itemIndex: 0,
    });
  });

  it('resolves entry id from builder data', () => {
    const data = emptyCVBuilderData({ email: 'a@b.com', name: 'A' });
    data.experience.items = [
      {
        id: 'job-1',
        title: 'Engineer',
        company: 'Acme',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: ['Built things'],
      },
    ];
    expect(
      resolveImprovementJumpTarget(data, 'experience[0].bullets[0]')?.entryId,
    ).toBe('job-1');
  });

  it('hides Fix with AI for user_action_required', () => {
    expect(isCvImprovementAiFixable({ resolutionType: 'user_action_required' })).toBe(
      false,
    );
    expect(isCvImprovementAiFixable({ resolutionType: 'ai_fixable' })).toBe(true);
    expect(isCvImprovementAiFixable({})).toBe(true);
  });

  it('canShowCvImprovementFixWithAI respects preview and resolution gates', () => {
    expect(
      canShowCvImprovementFixWithAI({ resolutionType: 'ai_fixable' }),
    ).toBe(true);
    expect(
      canShowCvImprovementFixWithAI({ resolutionType: 'user_action_required' }),
    ).toBe(false);
    expect(
      canShowCvImprovementFixWithAI({
        resolutionType: 'ai_fixable',
        pendingFieldPaths: ['summary.text'],
      }),
    ).toBe(false);
    expect(
      canShowCvImprovementFixWithAI({
        resolutionType: 'ai_fixable',
        lastPreviewDraftHash: 'abc',
      }),
    ).toBe(false);
    expect(
      canShowCvImprovementFixWithAI(
        { id: 'imp-1', resolutionType: 'ai_fixable' },
        'imp-1',
      ),
    ).toBe(false);
  });
});
