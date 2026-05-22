export type CoachingSuggestedStructure = 'STAR' | 'CAR' | 'FREEFORM';

export type CoachingEvaluationRubric = {
  clarity: number;
  structure: number;
  depth: number;
  relevance: number;
};

export type PreCoachingResponse = {
  intent: string;
  interviewerExpectation: string[];
  evaluationRubric: CoachingEvaluationRubric;
  suggestedStructure: CoachingSuggestedStructure;
  sampleAnswerBlueprint: string[];
  keyPointsToMention: string[];
  redFlagsToAvoid: string[];
  cacheHit: boolean;
  latencyMs: number;
};

export type LiveCoachingRequest = {
  buffer: string;
  elapsedSeconds?: number;
};

export type LiveCoachingResponse = {
  clarityRisk: number;
  structureRisk: number;
  verbosityRisk: number;
  missingElements: string[];
  hint: string;
  latencyMs: number;
};

export type PostCoachingScore = {
  clarity: number;
  structure: number;
  depth: number;
  relevance: number;
};

export type PostCoachingFollowUpType = 'clarity' | 'depth' | 'behavioral' | 'technical';

export type PostCoachingFollowUp = {
  question: string;
  reason: string;
  type: PostCoachingFollowUpType;
};

export type PostCoachingResponse = {
  score: PostCoachingScore;
  feedback: string[];
  improvedAnswer: string;
  coachingInsight: string;
  followUpTrigger: boolean;
  followUp?: PostCoachingFollowUp;
  cacheHit: boolean;
  source: 'gemini' | 'cached' | 'heuristic_fallback';
  latencyMs: number;
  geminiCallCountSession: number;
};

export type PostCoachingRequest = {
  answerText: string;
  durationSeconds?: number;
};

export type CoachingLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
