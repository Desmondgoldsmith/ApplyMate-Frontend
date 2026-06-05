import { describe, expect, it } from 'vitest';

import { assistantTargetSectionToEditorId } from '@/lib/cvAssistantCommit';
import { parseCvAssistantCommitResponse, type CVSectionRecord } from '@/lib/api';

describe('parseCvAssistantCommitResponse', () => {
  it('reads profile envelope, sections, and metadata', () => {
    const result = parseCvAssistantCommitResponse({
      success: true,
      data: {
        success: true,
        message: 'Changes saved to your CV.',
        targetSection: 'projects',
        sectionsSynced: true,
        cvRevisionId: 'rev-1',
        profile: {
          cvProfileId: 'prof-1',
          structured: { summary: 'Hi' },
          sections: [
            {
              id: 's1',
              type: 'projects',
              order: 1,
              visible: true,
              data: { items: [] },
            },
          ],
        },
      },
    });
    expect(result.profileId).toBe('prof-1');
    expect(result.message).toBe('Changes saved to your CV.');
    expect(result.targetSection).toBe('projects');
    expect(result.sectionsSynced).toBe(true);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.type).toBe('projects');
    expect(result.cvRevisionId).toBe('rev-1');
  });
});

describe('assistantTargetSectionToEditorId', () => {
  const sections: CVSectionRecord[] = [
    { id: 'sec_projects', type: 'projects', order: 4, hidden: false },
    { id: 'sec_custom', type: 'custom_volunteering', order: 9, hidden: false },
  ];

  it('maps fixed section keys', () => {
    expect(assistantTargetSectionToEditorId('projects', sections)).toBe('projects');
    expect(assistantTargetSectionToEditorId('summary', sections)).toBe('summary');
  });

  it('maps project slug hints to projects when row exists', () => {
    expect(assistantTargetSectionToEditorId('my_project_block', sections)).toBe(
      'projects',
    );
  });

  it('maps custom_* via section row type', () => {
    expect(assistantTargetSectionToEditorId('custom_volunteering', sections)).toBe(
      'custom_volunteering',
    );
  });
});
