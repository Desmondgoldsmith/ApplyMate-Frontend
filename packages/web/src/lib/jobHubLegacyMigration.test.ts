import { describe, expect, it } from 'vitest';

import { hubNoteScopeFromJob } from '@/lib/hubNotesQueryKeys';
import { resolveJobKeyToScope, type JobHubMigrationJob } from '@/lib/jobHubLegacyMigration';

describe('jobHubLegacyMigration', () => {
  const jobs: JobHubMigrationJob[] = [
    {
      key: 'analysis-1',
      jobAnalysisId: 'ja-1',
      applicationId: 'app-1',
      hubBookmarkId: null,
    },
    {
      key: 'hubbk:bm-1',
      jobAnalysisId: null,
      applicationId: null,
      hubBookmarkId: 'bm-1',
    },
  ];

  it('resolves analysis id to application scope first', () => {
    expect(resolveJobKeyToScope('analysis-1', jobs)).toEqual({
      kind: 'application',
      applicationId: 'app-1',
    });
  });

  it('resolves hub bookmark keys', () => {
    expect(resolveJobKeyToScope('hubbk:bm-1', jobs)).toEqual({
      kind: 'bookmark',
      bookmarkId: 'bm-1',
    });
  });

  it('hubNoteScopeFromJob matches migration scope priority', () => {
    expect(hubNoteScopeFromJob(jobs[0]!)).toEqual({
      kind: 'application',
      applicationId: 'app-1',
    });
  });
});
