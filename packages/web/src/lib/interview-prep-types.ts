import type { InterviewPersonality, InterviewResult, InterviewSession, InterviewType } from '@/lib/api';
import type { InterviewPersonaId, PersonalityPresentation } from '@/lib/interviewPersonas';

/** Coaching tone — separate from avatar `personality`. */
export type CoachPersonality = 'friendly' | 'professional' | 'strict' | 'fast_paced';

export type InterviewMode = 'job_based' | 'role_based';

export type PrepMode = 'standard' | 'hr_simulation' | 'senior_interviewer_simulation';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'adaptive';

export type InterviewerBehavior = 'neutral' | 'friendly' | 'strict' | 'interrupting';

export type StarMissingPart = 'situation' | 'task' | 'action' | 'result';

export type StarFeedback = {
  missingParts: StarMissingPart[];
  suggestionText: string;
  improvedHint?: string;
};

export type ReadinessBreakdown = {
  communication: number;
  structure: number;
  relevance: number;
  improvementTrend: number;
  confidenceProxy: number;
};

export type WeaknessTag = {
  tag: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  count: number;
};

export type WeaknessSnapshot = {
  weaknesses: WeaknessTag[];
  detectedAt: string;
};

export type TurnKind = 'main' | 'follow_up';

export type QuestionProgress = {
  mainTotal: number;
  mainAnswered: number;
  mainPending: number;
  optionalFollowUpTotal: number;
  optionalFollowUpPending: number;
  /** Answered optional follow-ups (preferred for UI badge; fallback: total − pending). */
  optionalFollowUpAnswered?: number;
};

export type PrepTurnsResponse = {
  turns: InterviewTurn[];
  questionProgress?: QuestionProgress | null;
};

export type TurnSyncPayload = {
  corrected: boolean;
  requestedTurnId: string;
  resolvedTurnId: string;
};

/** Heuristic + personalization copy while post-answer coaching loads (same turn response). */
export type ProcessingInsights = {
  headline: string;
  steps?: string[];
  interviewerContext?: string;
  whileYouWaitTips?: string[];
};

export type SuggestedFollowUp = {
  questionText: string;
  practiceOnly?: boolean;
  parentQuestionText?: string;
  contextLabel?: string;
  answerVia?: string;
};

export type InterviewTurn = {
  id: string;
  questionId: string;
  parentTurnId?: string;
  order: number;
  depth: number;
  category: string;
  questionText: string;
  context?: string;
  turnKind?: TurnKind;
  mainQuestionNumber?: number | null;
  label?: string;
  answerText?: string;
  durationSeconds?: number;
  clarityScore?: number;
  relevanceScore?: number;
  structureScore?: number;
  feedbackJson?: StarFeedback;
  status: 'pending' | 'answered' | 'skipped' | 'evaluated';
  /** Phase 2 — persisted coach payload (hydration). */
  coachInsight?: CoachInsight;
};

export type AnswerSource = 'typed' | 'browser_stt' | 'whisper' | 'manual';

export type FollowUpReason = 'vague' | 'missing_example' | 'missing_star' | 'short';

export type TurnAnswerScores = {
  clarityScore: number;
  relevanceScore: number;
  structureScore: number;
};

export type TurnCoaching = {
  message: string;
  tip: string;
  focusArea: string;
};

/** Phase B/C — per-session coaching control. */
export type CoachingIntensity = 'light' | 'standard' | 'intensive';

export type CoachingMode = 'real_time' | 'on_demand';

export type CoachingSettings = {
  enabled: boolean;
  intensity: CoachingIntensity;
  mode: CoachingMode;
};

export const DEFAULT_COACHING_SETTINGS: CoachingSettings = {
  enabled: true,
  intensity: 'standard',
  mode: 'real_time',
};

export type CoachingStarBreakdown = {
  situation?: string;
  action?: string;
  result?: string;
  task?: string;
};

/** Phase B/C — shaped coaching from turn submit (preferred for UI). */
export type CoachingFeedback = {
  /** Same string used for scoring — must match answered question. */
  questionText?: string;
  turnId?: string;
  summary: string;
  clarityScore: number;
  structureScore: number;
  depthScore: number;
  relevanceScore: number;
  focusArea: string;
  keyIssues: string[];
  improvements: string[];
  exampleAnswer: string | null;
  followUpQuestions: string[];
  interviewerInsight: string;
  starBreakdown?: CoachingStarBreakdown | null;
};

/** Phase 2 — heuristic coach insight (same request as turn submit). */
export type CoachInsightScore = {
  clarity: number;
  structure: number;
  relevance: number;
  depth: number;
};

export type CoachInsightSource = 'heuristic' | 'cached' | 'ai_enriched';

export type CoachInsight = {
  score: CoachInsightScore;
  feedback: string;
  hint: string;
  followUpQuestion?: string;
  sampleAnswer?: string;
  improvementPoints: string[];
  weakAnswer: boolean;
  cacheHit?: boolean;
  source?: CoachInsightSource;
  star?: StarFeedback;
};

export type TurnCoachingStatus = 'idle' | 'loading' | 'ready';

export type InterviewEmotion = 'neutral' | 'impressed' | 'concerned' | 'curious' | 'strict';

export type PressureTier = 'low' | 'medium' | 'high';

export type SimulationSignal =
  | 'ANSWER_STRONG'
  | 'ANSWER_WEAK'
  | 'USER_CONFIDENT'
  | 'USER_UNCERTAIN'
  | 'TIME_DELAY_HIGH';

export type SimulationPersona =
  | 'friendly_hr'
  | 'strict_hr'
  | 'senior_engineer'
  | 'startup_founder'
  | 'stress_interviewer';

export type SimulationNextBehavior =
  | 'question'
  | 'interruption'
  | 'follow_up'
  | 'pressure_escalation'
  | 'calm_reset';

export type SimulationQuestionStyle =
  | 'direct'
  | 'ambiguous'
  | 'scenario'
  | 'multi_part'
  | 'behavioral_deep';

export type SimulationPersonaTone = 'friendly' | 'neutral' | 'aggressive' | 'fast-paced';

export type SimulationPersonaBehavior = {
  tone: SimulationPersonaTone;
  followUpAggressiveness: number;
  patienceLevel: number;
};

export type SimulationInterruption = {
  occurred: boolean;
  message?: string;
};

/** Phase 4 — turn submit simulation feedback (simulation prep modes only). */
export type TurnSimulationFeedback = {
  emotion: InterviewEmotion;
  reactionText: string;
  pressureLevel: PressureTier;
  /** 0–100 gradual intensity (preferred for UI meter). */
  pressureIntensity?: number;
  pacingMultiplier: number;
  nextQuestionDifficulty: number;
  followUpStrategy: string;
  signals: SimulationSignal[];
  flowAction: string;
  nextBehavior?: SimulationNextBehavior;
  questionStyle?: SimulationQuestionStyle;
  persona?: SimulationPersona;
  personaBehavior?: SimulationPersonaBehavior;
  interruption?: SimulationInterruption;
  nudgeMessage: string | null;
  /** Dev/telemetry only — do not show in UI. */
  reasoningTags?: string[];
};

/** Phase 4 — live snapshot on simulation-state poll. */
export type SimulationLiveState = {
  emotion: InterviewEmotion | string;
  pressureTier: PressureTier;
  pressureIntensity?: number;
  pacingMultiplier: number;
  nextQuestionDifficulty: number;
  recentSignals: SimulationSignal[] | string[];
  reactionText: string | null;
  persona?: SimulationPersona;
  nextQuestionStyle?: string;
  interruptionCount?: number;
};

/** Phase 3 — dimensional profile updated each turn (heuristic). */
export type InterviewDimensionalProfile = {
  communicationClarityScore: number;
  technicalDepthScore: number;
  structureScore: number;
  confidenceScore: number;
  consistencyScore: number;
  weakAreas: string[];
  strongAreas: string[];
  recommendedDifficulty: 'easy' | 'medium' | 'hard';
  updatedAt: string;
};

export type NextQuestionType =
  | 'behavioral'
  | 'technical'
  | 'situational'
  | 'stress_test'
  | 'easy_reset';

export type AdaptiveSessionUpdate = {
  difficultyLevel: DifficultyLevel;
  recommendedDifficulty: 'easy' | 'medium' | 'hard';
  adaptationReason: string;
  nextQuestionType: NextQuestionType;
  recommendedNextTurnId?: string;
  flowChanged: boolean;
};

export type TurnAdaptivePayload = {
  profile: InterviewDimensionalProfile;
  session: AdaptiveSessionUpdate;
  /** Telemetry only — do not show in UI. */
  reasoningTags?: string[];
};

/** Phase 2B — unified coaching snapshot (one pass per answer, turn submit). */
export type CoachingSnapshotScore = {
  clarity: number;
  structure: number;
  depth: number;
  relevance: number;
};

export type CoachingSnapshotLevel = 'easy' | 'medium' | 'hard';

export type CoachingSnapshot = {
  score: CoachingSnapshotScore;
  strengths: string[];
  weaknesses: string[];
  coachingSummary: string;
  improvedAnswer: string;
  /** Sanitized example — no question text repeated. */
  improvedAnswerSafe?: string;
  followUpQuestions: string[];
  nextHint: string;
  level: CoachingSnapshotLevel;
  cacheHit: boolean;
  source: 'gemini' | 'cached' | 'heuristic';
  latencyMs: number;
};

export type NextQuestionPayload = {
  turnId?: string;
  questionText: string;
  source: 'follow_up' | 'adaptive' | 'planned';
  turnKind?: TurnKind;
  mainQuestionNumber?: number | null;
  label?: string;
};

/** Authoritative question the user just answered (turn submit). */
export type AnsweredQuestionPayload = {
  turnId: string;
  questionId: string;
  questionText: string;
  context?: string;
  turnKind?: TurnKind;
  mainQuestionNumber?: number | null;
  label?: string;
  /** Polished transcript stored for reports (prefer over raw STT). */
  scoredAnswerText?: string;
  transcriptPolished?: boolean;
};

/** Phase D/E — longitudinal skill tracking (heuristic, no extra AI). */
export type SkillTrend = 'improving' | 'stagnant' | 'declining' | 'stable';

export type SkillScores = {
  clarity: number;
  structure: number;
  depth: number;
  confidence: number;
  relevance?: number;
};

export type SkillHistoryPoint = {
  capturedAt: string;
  sessionId: string;
  scores: SkillScores;
  composite: number;
};

export type WeaknessProfile = {
  topWeaknesses: string[];
  trend: SkillTrend;
  tags?: string[];
};

export type RealTimeSignals = {
  nudges: string[];
  urgency?: 'low' | 'medium' | 'high';
};

export type DifficultyHint = {
  difficultyLevel: 'easy' | 'medium' | 'hard';
  questionStyle?: string;
  rules?: string[];
  reason?: string;
};

export type PersonalizationPayload = {
  skills: SkillScores;
  weaknessProfile: WeaknessProfile;
  realTimeSignals: RealTimeSignals;
  difficultyHint?: DifficultyHint;
};

export type SkillProfileResponse = {
  skills: SkillScores;
  skillHistory: SkillHistoryPoint[];
  weaknessProfile: WeaknessProfile;
  lastWeaknesses: string[];
  improvementTrend: SkillTrend;
  compositeScore: number;
};

export type TurnAnswerResponse = {
  turn: InterviewTurn;
  scores: TurnAnswerScores;
  starFeedback: StarFeedback;
  followUp: null | {
    turnId: string;
    question: string;
    reason: FollowUpReason;
  };
  coachMessage?: string;
  interruption?: boolean;
  /** Phase 3 — heuristic coaching after turn submit (optional). */
  coaching?: TurnCoaching;
  /** Phase 2 — primary coaching payload (instant, same response). */
  coachInsight?: CoachInsight;
  /** Phase 2B — unified snapshot (preferred for post-answer UI). */
  coachingSnapshot?: CoachingSnapshot;
  /** Phase 2B — next step without extra round-trip (null when mains done). */
  nextQuestion?: NextQuestionPayload | null;
  /** Next main pending question (depth 0) — use for Skip / Next when not accepting follow-up. */
  nextPlannedQuestion?: NextQuestionPayload | null;
  /** Optional follow-up turn after mains complete — do not auto-navigate on Continue. */
  optionalNextQuestion?: NextQuestionPayload | null;
  /** True when all main questions are answered — safe to end without advancing optional turns. */
  canCompleteInterview?: boolean;
  /** Optional practice / follow-up chips. */
  suggestedFollowUps?: SuggestedFollowUp[] | string[];
  /** Question the user actually answered on this submit. */
  answeredQuestion?: AnsweredQuestionPayload;
  /** Present when URL turnId did not match questionText — server resolved another turn. */
  turnSync?: TurnSyncPayload;
  /** Main vs optional follow-up counts (also on GET turns). */
  questionProgress?: QuestionProgress;
  /** Phase 3 — adaptive intelligence (same response). */
  adaptive?: TurnAdaptivePayload;
  /** Phase 4 — simulation mode only. */
  simulation?: TurnSimulationFeedback;
  /** Phase B/C — session coaching settings echo. */
  coachingSettings?: CoachingSettings;
  /** Phase B/C — shaped coaching (when enabled + real_time or requestCoaching). */
  coachingFeedback?: CoachingFeedback | null;
  /** Phase D/E — skill + nudges + next-question difficulty (additive). */
  personalization?: PersonalizationPayload;
  /** Shown while coaching payload hydrates — no extra poll. */
  processingInsights?: ProcessingInsights;
};

export type PracticeCoachingResponse = {
  practiceOnly: true;
  coachingFeedback: CoachingFeedback;
  coachingSnapshot?: CoachingSnapshot;
  coachingSettings?: CoachingSettings;
};

export type ImprovementPlanItem = {
  weakness: string;
  action: string;
  priority: number;
};

export type InterviewImprovementPlan = {
  planId: string;
  sessionId: string;
  suggestedMode: string;
  items: ImprovementPlanItem[];
  expiresAt?: string;
  createdAt: string;
};

export type ProgressTrendPoint = {
  sessionId: string;
  compositeScore: number;
  readinessScore: number | null;
  capturedAt: string;
};

export type InterviewProgressSnapshot = {
  sessions: ProgressTrendPoint[];
  trend: {
    averageComposite: number;
    improvementVelocity: number;
    sessionCount: number;
  };
  improvementTrend?: ProgressTrendPoint[];
  weakestCategories?: string[];
  readinessGrowthChart?: Array<{ capturedAt: string; readinessScore: number }>;
};

export type PreviousSessionComparison = {
  previousSessionId: string | null;
  previousCompositeScore: number | null;
  compositeDelta: number | null;
  readinessDelta: number | null;
  improvedSinceLastSession: boolean;
  improvementInsight: string;
  skillDelta: Record<string, number>;
};

export type SessionAdaptation = {
  difficultyLevel: DifficultyLevel;
  adaptationReason: string;
  weaknessTargeted: string[];
  improvedSinceLastSession: boolean;
};

export type PreferredDifficultyBand = 'easy' | 'balanced' | 'hard';

export type AdaptiveProfile = {
  averageAnswerScore: number;
  weakestCategories: string[];
  strongestCategories: string[];
  improvementTrend: ProgressTrendPoint[];
  confidenceScore: number;
  lastInterviewAt: string | null;
  recommendedFocusAreas: string[];
  recommendedDifficulty: DifficultyLevel;
  /** Phase 3 — long-term memory (when backend exposes on adaptive-profile). */
  weaknessTags?: WeaknessTag[];
  strengthTags?: string[];
  improvementTrendScore?: number;
  preferredDifficulty?: PreferredDifficultyBand;
  /** Phase 3 — dimensional profile from GET /adaptive-profile. */
  adaptiveProfile?: InterviewDimensionalProfile | null;
  /** Phase D/E — optional on adaptive-profile. */
  skills?: SkillScores;
  weaknessTrend?: SkillTrend;
  lastWeaknesses?: string[];
};

export type EnrichedPrepSession = InterviewSession & InterviewSessionPrepFields & {
  previousSessionComparison?: PreviousSessionComparison;
  adaptation?: SessionAdaptation;
};

export type SimulationState = {
  timer: {
    questionTimeLimitSec: number;
    totalDurationLimitSec?: number;
    currentTurnIndex: number;
  };
  pressureLevel: number;
  stressLevel: number;
  interviewerBehavior: InterviewerBehavior;
  nudgeMessage: string | null;
  lastNudgeAt: string | null;
  mode: PrepMode;
  /** Phase 4 — enriched live simulation snapshot. */
  simulation?: SimulationLiveState;
};

export type SimulateSessionBody = {
  mode: 'hr_simulation' | 'senior_interviewer_simulation';
  jobAnalysisId?: string;
  cvProfileId?: string;
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  roleTitle?: string;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  stressMode?: boolean;
  questionTimeLimitSec?: number;
  totalQuestions?: number;
  personality?: InterviewPersonality;
  interviewPersona?: InterviewPersonaId;
  coachPersonality?: CoachPersonality;
  speakingSpeed?: number;
};

export type RealityScoreBreakdown = {
  confidenceUnderPressure?: number;
  clarityUnderInterruption?: number;
  behavioralStrength?: number;
  communicationUnderTimePressure?: number;
  overallRealityScore?: number;
};

/** Telemetry from backend question generation v2 (`setupMetadataJson.questionGeneration`). */
export type QuestionGenerationMetadata = {
  questionGenerationVersion?: number;
  varietySeed?: string;
  excludedStemCount?: number;
  priorSessionCount?: number;
  duplicateFromSessionId?: string | null;
  overlapRatio?: number | null;
};

export type InterviewSetupMetadata = {
  questionGeneration?: QuestionGenerationMetadata;
};

/** Extended session fields from Phase 1–4 (all optional on legacy sessions). */
export type InterviewSessionPrepFields = {
  setupMetadataJson?: InterviewSetupMetadata;
  interviewMode?: InterviewMode;
  coachPersonality?: CoachPersonality;
  interviewerPersonality?: CoachPersonality;
  interviewPersona?: InterviewPersonaId;
  interviewerLabel?: string;
  interviewerRoleLabel?: string;
  interviewerAvatar?: string;
  interviewerColor?: string;
  personalityPresentation?: PersonalityPresentation;
  speakingSpeed?: number;
  roleTitle?: string;
  turns?: InterviewTurn[];
  readinessScore?: number;
  readinessBreakdown?: ReadinessBreakdown;
  weaknessSnapshot?: WeaknessSnapshot;
  prepMode?: PrepMode;
  adaptiveDifficulty?: boolean;
  stressLevel?: number;
  stressMode?: boolean;
  questionTimeLimitSec?: number;
  realityScore?: RealityScoreBreakdown;
  coachingSettings?: CoachingSettings;
};

export type InterviewSessionWithPrep = InterviewSession & InterviewSessionPrepFields;

export type InterviewResultWithPrep = InterviewResult & {
  readinessScore?: number;
  readinessBreakdown?: ReadinessBreakdown;
  realityScore?: RealityScoreBreakdown;
};

export type CreateInterviewSessionBody = {
  cvProfileId?: string;
  jobAnalysisId?: string;
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  interviewType?: InterviewType;
  personality?: InterviewPersonality;
  totalQuestions?: number;
  interviewMode?: InterviewMode;
  roleTitle?: string;
  coachPersonality?: CoachPersonality;
  interviewerPersonality?: CoachPersonality;
  interviewPersona?: InterviewPersonaId;
  interviewerLabel?: string;
  interviewerRoleLabel?: string;
  interviewerAvatar?: string;
  interviewerColor?: string;
  personalityPresentation?: PersonalityPresentation;
  speakingSpeed?: number;
  adaptiveDifficulty?: boolean;
  prepMode?: PrepMode;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  stressMode?: boolean;
  questionTimeLimitSec?: number;
  coachingEnabled?: boolean;
  coachingIntensity?: CoachingIntensity;
  coachingMode?: CoachingMode;
};

export const WEAKNESS_TAG_LABELS: Record<string, string> = {
  vague_answers: 'Too vague',
  weak_star_structure: 'STAR structure missing',
  answers_too_short: 'Answers too short',
  off_topic: 'Off-topic responses',
  missing_metrics: 'Missing metrics / outcomes',
};

export const CATEGORY_LABELS: Record<string, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  cv: 'CV & experience',
  job: 'Role fit',
  mixed: 'Mixed',
  communication: 'Communication',
  structure: 'Structure',
};

export const FOLLOW_UP_REASON_COPY: Record<FollowUpReason, string> = {
  vague: "Let's go deeper on that — be more specific.",
  missing_example: 'Can you give me a concrete example?',
  missing_star: 'Walk me through Situation, Action, and Result.',
  short: 'Can you expand on that a bit more?',
};

export const PREP_MODE_LABELS: Record<PrepMode, string> = {
  standard: 'Standard practice',
  hr_simulation: 'HR interview simulation',
  senior_interviewer_simulation: 'Hiring manager simulation',
};

export const SUGGESTED_MODE_LABELS: Record<string, string> = {
  behavioral_star: 'STAR behavioral practice',
  quick_practice: 'Quick practice',
  full_mock: 'Full mock interview',
  weakness_focus: 'Weakness focus',
  adaptive: 'Adaptive interview',
  hr_simulation: 'HR simulation',
  senior_interviewer_simulation: 'Manager simulation',
};

export function isSimulationMode(prepMode?: PrepMode): boolean {
  return prepMode === 'hr_simulation' || prepMode === 'senior_interviewer_simulation';
}

export function formatCategoryLabel(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_LABELS[key] ?? category.replace(/_/g, ' ');
}
