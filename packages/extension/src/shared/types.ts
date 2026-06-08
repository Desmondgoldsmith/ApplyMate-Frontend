export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  extensionToken: string | null;
};

export type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  postedDate: string | null;
  sourceUrl: string;
  sourceSite: string;
  confidence: 'high' | 'medium' | 'low';
  extractedBy: 'site-extractor' | 'ai-fallback' | 'manual';
};

export type JobExtractionState =
  | { status: 'idle' }
  | { status: 'detecting' }
  | { status: 'extracting' }
  | { status: 'ready'; job: ExtractedJob }
  | { status: 'not-a-job-page' }
  | { status: 'error'; message: string };

export type MessageAction =
  | { action: 'openSidebar' }
  | { action: 'setToken'; token: string; expiresAt?: string }
  | { action: 'getAuthState' }
  | { action: 'syncAuth' }
  | { action: 'authUpdated' }
  | { action: 'jobExtracted'; job: ExtractedJob }
  | { action: 'autofill'; data: Record<string, string> }
  | { action: 'unauthorized' }
  | { action: 'clearToken' }
  | { action: 'jobDetected'; url: string; siteName: string }
  | { action: 'extractionError'; message: string }
  | { action: 'requestExtraction' }
  | { action: 'clearJob' }
  | { action: 'notAJobPage' }
  | {
      action: 'extractJobAI';
      payload: { rawText: string; pageTitle: string; pageUrl: string };
    }
  | { action: 'saveJob'; payload: SaveJobPayload }
  | { action: 'jobSaved'; jobId: string; jobStatus: string }
  | { action: 'saveError'; message: string }
  | { action: 'checkJobSaved'; url: string }
  | { action: 'jobCheckResult'; result: CheckResponse; url?: string }
  | { action: 'getJobSession'; url?: string }
  | { action: 'activeTabChanged'; url: string }
  | { action: 'probeActiveJob' }
  | { action: 'reloadActiveTabForJob' }
  | { action: 'importJobFromUrl'; url: string }
  | { action: 'runProbe' }
  | { action: 'jobSessionUpdated'; session: ExtensionJobSession }
  | { action: 'setSelectedCvId'; cvId: string }
  | { action: 'requestRecentJobs' }
  | { action: 'getCvProfiles' }
  | {
      action: 'getCvScore';
      cvId: string;
      jobDescription: string;
      jobTitle: string;
      company?: string;
      jobAnalysisId?: string | null;
      sourceUrl?: string;
      sourceSite?: string;
    }
  | {
      action: 'generateCoverLetter';
      cvId: string;
      jobDescription: string;
      jobTitle: string;
      company: string;
      jobLocation?: string;
      jobType?: string;
      jobAnalysisId?: string | null;
      sourceUrl?: string;
    }
  | { action: 'cvProfilesResult'; profiles: CvProfile[] }
  | { action: 'cvScoreResult'; result: CvScoreResult }
  | { action: 'aiUsageUpdated'; aiUsage: AiUsageSnapshot }
  | { action: 'coverLetterResult'; result: CoverLetterResult }
  | { action: 'cvScoreError'; message: string }
  | { action: 'coverLetterError'; message: string }
  | { action: 'initiateTailor'; payload: InitiateTailorPayload }
  | { action: 'tailorInitiated'; session: TailorSession }
  | { action: 'tailorInitiateError'; message: string }
  | { action: 'checkTailorStatus'; sessionId: string }
  | {
      action: 'tailorStatusResult';
      completed: boolean;
      tailoredCvId: string | null;
    };

export type GetAuthStateResponse =
  | { isAuthenticated: true; user: User }
  | { isAuthenticated: false; user?: null };

export type SyncAuthResponse = GetAuthStateResponse;

export type SetTokenResponse = { success: true };

export type RequestExtractionResponse = { job: ExtractedJob | null };

export type ExtensionJobSession = {
  pageUrl: string;
  jobAnalysisId: string | null;
  extractedJob: ExtractedJob | null;
  check: CheckResponse | null;
  score: CvScoreResult | null;
  coverLetter: CoverLetterResult | null;
  selectedCvId: string | null;
};

export type GetJobSessionResponse = {
  session: ExtensionJobSession | null;
};

export type SaveJobPayload = {
  title: string;
  company?: string;
  location?: string;
  description?: string;
  salary?: string;
  jobType?: string;
  experienceLevel?: string;
  postedDate?: string;
  sourceUrl: string;
  sourceSite: string;
};

export type SavedJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  sourceSite: string | null;
  savedAt: string;
  hasAnalysis?: boolean;
  matchScore?: number | null;
};

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; jobId: string; jobStatus: string }
  | { status: 'error'; message: string };

export type CheckResponse = {
  saved: boolean;
  jobId: string | null;
  status: string | null;
  hasAnalysis?: boolean;
  matchScore?: number | null;
  scoreLabel?: string | null;
  hasCoverLetter?: boolean;
  dashboardUrl?: string | null;
  aiUsage?: AiUsageSnapshot;
};

export type SkillCoverageItem = {
  skill: string;
  status: 'found' | 'missing' | string;
  importance?: string;
};

export type RequestRecentJobsResponse = { jobs: SavedJob[] };

export type CheckJobSavedResponse = { result: CheckResponse };

export type CvProfile = {
  id: string;
  name: string;
  lastUpdated: string;
  isDefault: boolean;
};

export type ScoreFactors = {
  skills: number;
  experience: number;
  keywords: number;
  seniority: number;
  industry: number;
};

export type AiUsageSnapshot = {
  aiUsesToday: number;
  aiDailyLimit: number | null;
  aiUsesRemaining: number | null;
  aiUsageResetsAt: string;
};

export type MissingSkill = {
  skill: string;
  importance?: string;
};

export type LocationEligibility = {
  jobLocations?: string[];
  detectedUserCountryCode?: string | null;
  detectedUserCountryName?: string | null;
  message: string;
};

export type JobSalaryEstimate = {
  currency: string;
  min: number;
  max: number;
  median?: number;
  basis?: string;
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
  source?: 'job_description' | 'ai_estimate' | string;
  sourceLabel?: string;
  disclaimer?: string;
};

export type CvScoreResult = {
  matchScore: number;
  scoreLabel: 'Excellent' | 'Strong' | 'Good' | 'Fair' | 'Weak';
  factors: ScoreFactors;
  topStrengths: string[];
  topGaps: string[];
  missingSkills?: MissingSkill[];
  skillCoverage?: SkillCoverageItem[];
  skillsToHighlight?: string[];
  recommendation: string;
  jobAnalysisId?: string | null;
  dashboardUrl?: string | null;
  persisted?: boolean;
  fromCache?: boolean;
  aiUsage?: AiUsageSnapshot;
  scoreSource?: 'ai' | 'heuristic' | string;
  salaryEstimate?: JobSalaryEstimate | null;
  locationEligibility?: LocationEligibility | null;
};

export type CoverLetterResult = {
  coverLetter: string;
  wordCount: number;
  generatedAt: string;
  jobAnalysisId?: string | null;
  dashboardUrl?: string | null;
  persisted?: boolean;
};

export type CvTabState = {
  profiles: CvProfile[];
  profilesLoading: boolean;
  selectedCvId: string | null;
  currentJob: ExtractedJob | null;
  scoreState:
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'done'; result: CvScoreResult }
    | { status: 'error'; message: string };
  coverLetterState:
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'done'; result: CoverLetterResult }
    | { status: 'error'; message: string };
};

export type InitiateTailorPayload = {
  cvId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  returnToUrl: string;
  jobLocation?: string;
  jobType?: string;
};

export type TailorSession = {
  sessionId: string;
  dashboardUrl: string;
  expiresAt: string;
};

export type TailorStatus =
  | { status: 'idle' }
  | { status: 'initiating' }
  | { status: 'in-progress'; sessionId: string }
  | { status: 'completed'; tailoredCvId: string }
  | { status: 'error'; message: string };
