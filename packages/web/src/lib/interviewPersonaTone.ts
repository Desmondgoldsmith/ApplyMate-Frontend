import type { DifficultyLevel, PreferredDifficultyBand } from '@/lib/interview-prep-types';

export type InterviewerToneProfile = 'beginner' | 'average' | 'advanced';

export type InterviewerToneAdjustments = {
  profile: InterviewerToneProfile;
  speakingSpeedMultiplier: number;
  transitionPauseMs: number;
  moodHint: string;
};

const FOCUS_AREA_LABELS: Record<string, string> = {
  structure: 'Structure',
  clarity: 'Clarity',
  relevance: 'Relevance',
  depth: 'Depth',
  confidence: 'Confidence',
  communication: 'Communication',
};

export function formatFocusAreaLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return FOCUS_AREA_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Maps long-term memory + session difficulty to interviewer delivery style. */
export function resolveInterviewerToneProfile(options: {
  averageAnswerScore?: number | null;
  improvementTrendScore?: number | null;
  recommendedDifficulty?: DifficultyLevel | PreferredDifficultyBand | null;
  sessionDifficulty?: DifficultyLevel | null;
}): InterviewerToneProfile {
  const avg = options.averageAnswerScore ?? 0;
  const trend = options.improvementTrendScore;
  const diff =
    options.sessionDifficulty ?? options.recommendedDifficulty ?? 'balanced';

  if (diff === 'hard' || avg >= 78 || (trend != null && trend >= 8)) return 'advanced';
  if (diff === 'easy' || avg < 52 || (trend != null && trend < 0)) return 'beginner';
  return 'average';
}

export function interviewerToneAdjustments(profile: InterviewerToneProfile): InterviewerToneAdjustments {
  switch (profile) {
    case 'beginner':
      return {
        profile,
        speakingSpeedMultiplier: 0.92,
        transitionPauseMs: 520,
        moodHint: 'Supportive pace — take your time with each answer.',
      };
    case 'advanced':
      return {
        profile,
        speakingSpeedMultiplier: 1.06,
        transitionPauseMs: 280,
        moodHint: 'Challenging pace — be concise and evidence-led.',
      };
    default:
      return {
        profile: 'average',
        speakingSpeedMultiplier: 1,
        transitionPauseMs: 400,
        moodHint: 'Balanced interview pace.',
      };
  }
}
