/**
 * Central React Query cache keys for `@applymate/web`.
 * Always import `queryKeys` instead of inline tuple literals.
 */

export const queryKeys = {
  auth: {
    me: (accessToken = '') => ['auth', 'me', accessToken] as const,
  },

  analytics: {
    root: (accessToken = '') => ['analytics', accessToken] as const,
  },

  cv: {
    root: () => ['cv'] as const,
    profiles: () => ['cv', 'profiles'] as const,
    /** GET /cv/profile (active / default profile). */
    profileDefault: () => ['cv', 'profile'] as const,
    profile: (id: string) => ['cv', 'profile', id] as const,
    sectionsRoot: () => ['cv', 'sections'] as const,
    sections: (profileId: string) => ['cv', 'sections', profileId] as const,
    sectionsWithHidden: (profileId: string, includeHidden: boolean) =>
      ['cv', 'sections', profileId, includeHidden] as const,
    /** Default-profile section list (`useCVSections`). */
    sectionsActive: (includeHidden = false) =>
      ['cv', 'sections', 'active', includeHidden] as const,
    score: (profileId?: string | null) =>
      ['cv', 'score', profileId?.trim() || 'default'] as const,
    scoreRoot: () => ['cv', 'score'] as const,
    suggestions: (profileId?: string | null) =>
      ['cv', 'suggestions', profileId?.trim() || 'default'] as const,
    suggestionsRoot: () => ['cv', 'suggestions'] as const,
    sectionOrderSuggest: (profileId: string) =>
      ['cv', 'section-order-suggest', profileId] as const,
    recruiterScan: (profileId: string) =>
      ['cv', 'recruiter-scan', profileId] as const,
    assistantGlobalOperations: () =>
      ['cv', 'assistant', 'global-operations'] as const,
  },

  jobs: {
    root: () => ['jobs'] as const,
    analyses: () => ['jobs', 'analyses'] as const,
    analysesListing: (discoveryJobId: string) =>
      ['jobs', 'analyses', 'listing', discoveryJobId] as const,
    /** GET /jobs/:id (saved job record + analysis payload). */
    analysis: (jobId: string) => ['jobs', 'analysis', jobId] as const,
    analysisCurrent: () => ['jobs', 'analysis-current'] as const,
    history: (includeAccepted = false) =>
      ['jobs', 'history', includeAccepted] as const,
    historyWithPagination: (
      limit: number | string,
      offset: number,
      includeAccepted = false,
    ) => ['jobs', 'history', limit, offset, includeAccepted] as const,
    historyPage: (limit: number, offset: number) =>
      ['jobs', 'history', 'page', limit, offset] as const,
    generated: (jobId: string) => ['jobs', 'generated', jobId] as const,
    applyUrl: (listingId: string) => ['jobs', 'apply-url', listingId] as const,
    archive: () => ['jobs', 'archive'] as const,
    discovery: (params: unknown) => ['jobs', 'discovery', params] as const,
    discoveryDetail: (listingId: string) =>
      ['jobs', 'discovery-detail', listingId] as const,
    boardAiMatch: (cvProfileId: string, discoveryJobId: string) =>
      ['jobs', 'board-ai-match', cvProfileId, discoveryJobId] as const,
    boardOverQuotaReuse: (cvProfileId: string, discoveryJobId: string) =>
      ['jobs', 'board-over-quota-reuse', cvProfileId, discoveryJobId] as const,
    boardQuotaFit: (
      cvProfileId: string,
      discoveryJobId: string,
      descriptionSlice: string,
    ) =>
      [
        'jobs',
        'board-quota-fit',
        cvProfileId,
        discoveryJobId,
        descriptionSlice,
      ] as const,
  },

  applications: {
    root: () => ['applications'] as const,
  },

  hub: {
    bookmarks: () => ['hub', 'bookmarks'] as const,
    notesRoot: () => ['hub', 'notes'] as const,
    notesApplication: (applicationId: string) =>
      ['hub', 'notes', 'application', applicationId] as const,
    notesJobAnalysis: (jobAnalysisId: string) =>
      ['hub', 'notes', 'job-analysis', jobAnalysisId] as const,
    notesBookmark: (bookmarkId: string) =>
      ['hub', 'notes', 'bookmark', bookmarkId] as const,
    notesGlobal: (cursor = '') => ['hub', 'notes', 'global', cursor] as const,
    /** Disabled `useHubNotes` query (no scope); query never runs. */
    notesDisabled: () => ['hub', 'notes', 'none'] as const,
    remindersRoot: () => ['hub', 'reminders'] as const,
    remindersFilter: (filter: {
      jobAnalysisId?: string;
      jobBookmarkId?: string;
      status?: string;
    }) =>
      [
        'hub',
        'reminders',
        {
          jobAnalysisId: filter.jobAnalysisId ?? '',
          jobBookmarkId: filter.jobBookmarkId ?? '',
          status: filter.status ?? '',
        },
      ] as const,
    remindersJobDetail: (jobAnalysisId: string) =>
      ['hub', 'reminders', 'job-detail', jobAnalysisId] as const,
  },

  /** GET /dashboard/today-plan — keep legacy root segment for stable invalidation. */
  todayPlan: {
    root: () => ['today-plan'] as const,
    key: (
      cvProfileId: string,
      timezone: string,
      includeHidden: boolean,
      focusFeedMaxItems: number | 'default',
    ) =>
      ['today-plan', cvProfileId, timezone, includeHidden, focusFeedMaxItems] as const,
  },

  dashboardFocus: {
    root: () => ['dashboard-focus'] as const,
    key: (cvProfileId: string, timezone: string) =>
      ['dashboard-focus', cvProfileId, timezone] as const,
  },

  weeklyStallSummary: {
    root: () => ['weekly-stall-summary'] as const,
    key: (limit: number) => ['weekly-stall-summary', limit] as const,
  },

  career: {
    dashboard: () => ['career', 'dashboard'] as const,
    goals: () => ['career-goals'] as const,
  },

  growth: {
    root: () => ['growth'] as const,
    dailyDirection: () => ['growth', 'daily-direction'] as const,
    progress: (window: string) => ['growth', 'progress', window] as const,
    momentumNudges: () => ['growth', 'momentum-nudges'] as const,
    achievements: () => ['growth', 'achievements'] as const,
  },

  interview: {
    sessions: () => ['interview-sessions'] as const,
    session: (sessionId: string) => ['interview-session', sessionId] as const,
    result: (sessionId: string) => ['interview-result', sessionId] as const,
  },

  interviewPrep: {
    progress: () => ['interview-prep', 'progress'] as const,
    quota: () => ['interview-prep', 'quota'] as const,
    adaptiveProfile: () => ['interview-prep', 'adaptive-profile'] as const,
    skillProfile: () => ['interview-prep', 'skill-profile'] as const,
    session: (sessionId: string) =>
      ['interview-prep', 'session', sessionId] as const,
    turns: (sessionId: string) => ['interview-prep', 'turns', sessionId] as const,
    plan: (sessionId: string) => ['interview-prep', 'plan', sessionId] as const,
    simulationState: (sessionId: string) =>
      ['interview-prep', 'simulation-state', sessionId] as const,
  },

  notifications: {
    list: () => ['notifications', 'list'] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },

  onboarding: {
    statusRoot: () => ['onboarding', 'status'] as const,
    status: (accessToken = '') =>
      ['onboarding', 'status', accessToken] as const,
    cvDefaultProfile: (accessToken = '') =>
      ['onboarding', 'cv-default-profile', accessToken] as const,
  },

  coaching: {
    settings: () => ['coaching', 'settings'] as const,
  },

  location: {
    bootstrap: () => ['location', 'bootstrap'] as const,
  },
} as const;
