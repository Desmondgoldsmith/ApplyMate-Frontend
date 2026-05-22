'use client';

import { useMemo } from 'react';

import {
  INTERVIEW_ADAPTIVE_PROFILE_KEY,
  INTERVIEW_PREP_PROGRESS_KEY,
  useAdaptiveProfile,
  useEnrichedPrepSession,
  useInterviewPrepProgress,
} from '@/hooks/useInterviewPrep';
import type { InterviewSession } from '@/lib/api';
import {
  formatFocusAreaLabel,
  interviewerToneAdjustments,
  resolveInterviewerToneProfile,
  type InterviewerToneAdjustments,
  type InterviewerToneProfile,
} from '@/lib/interviewPersonaTone';
import type {
  DifficultyLevel,
  PreferredDifficultyBand,
  PreviousSessionComparison,
  SessionAdaptation,
  TurnCoaching,
  WeaknessTag,
} from '@/lib/interview-prep-types';
import { WEAKNESS_TAG_LABELS } from '@/lib/interview-prep-types';

export type InterviewPersonaMemory = {
  weaknessTags: WeaknessTag[];
  strengthTags: string[];
  coachingTips: string[];
  difficultyLevel: DifficultyLevel;
  preferredDifficulty: PreferredDifficultyBand;
  improvementTrendScore: number | null;
  averageAnswerScore: number;
  improvementVelocity: number;
  sessionCount: number;
  primaryFocusArea: string | null;
  strongestSkillArea: string | null;
  repeatedWeaknesses: string[];
  sessionAdaptation: SessionAdaptation | null;
  previousComparison: PreviousSessionComparison | null;
  toneProfile: InterviewerToneProfile;
  toneAdjustments: InterviewerToneAdjustments;
  isLoading: boolean;
};

function weaknessLabel(tag: string): string {
  return WEAKNESS_TAG_LABELS[tag] ?? tag.replace(/_/g, ' ');
}

function mergeWeaknessTags(
  profileTags: WeaknessTag[] | undefined,
  sessionTags: WeaknessTag[] | undefined,
  categories: string[] | undefined,
): WeaknessTag[] {
  const byTag = new Map<string, WeaknessTag>();

  for (const t of profileTags ?? []) {
    if (t?.tag) byTag.set(t.tag, t);
  }
  for (const t of sessionTags ?? []) {
    if (t?.tag) {
      const prev = byTag.get(t.tag);
      byTag.set(t.tag, prev ? { ...prev, count: Math.max(prev.count, t.count) } : t);
    }
  }
  for (const cat of categories ?? []) {
    const key = cat.trim().toLowerCase();
    if (!key || byTag.has(key)) continue;
    byTag.set(key, {
      tag: key,
      severity: 'medium',
      explanation: `Recurring focus: ${formatFocusAreaLabel(key)}`,
      count: 1,
    });
  }

  return [...byTag.values()].sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0) || b.count - a.count;
  });
}

export function useInterviewPersonaMemory(options: {
  sessionId?: string | null;
  session?: InterviewSession | null;
  enabled?: boolean;
}) {
  const { sessionId = null, session = null, enabled = true } = options;

  const profileQ = useAdaptiveProfile(enabled);
  const progressQ = useInterviewPrepProgress(enabled);
  const enrichedQ = useEnrichedPrepSession(sessionId, Boolean(sessionId) && enabled);

  const memory = useMemo((): InterviewPersonaMemory => {
    const profile = profileQ.data;
    const progress = progressQ.data;
    const adaptation = enrichedQ.data?.adaptation;
    const comparison = enrichedQ.data?.previousSessionComparison;

    const weaknessTags = mergeWeaknessTags(
      profile?.weaknessTags,
      session?.weaknessSnapshot?.weaknesses,
      profile?.weakestCategories,
    );

    const strengthTags = [
      ...(profile?.strengthTags ?? []),
      ...(profile?.strongestCategories ?? []),
    ].filter((s, i, arr) => s && arr.indexOf(s) === i);

    const coachingTips = [
      ...(profile?.recommendedFocusAreas ?? []).map(formatFocusAreaLabel),
      ...(adaptation?.weaknessTargeted ?? []).map(formatFocusAreaLabel),
    ].filter((t, i, arr) => t && arr.indexOf(t) === i);

    const difficultyLevel: DifficultyLevel =
      adaptation?.difficultyLevel ?? profile?.recommendedDifficulty ?? 'adaptive';

    const preferredDifficulty: PreferredDifficultyBand =
      profile?.preferredDifficulty ??
      (difficultyLevel === 'easy' || difficultyLevel === 'hard' ? difficultyLevel : 'balanced');

    const primaryFocusArea =
      coachingTips[0] ??
      (weaknessTags[0] ? weaknessLabel(weaknessTags[0].tag) : null) ??
      (profile?.weakestCategories?.[0] ? formatFocusAreaLabel(profile.weakestCategories[0]) : null);

    const strongestSkillArea =
      strengthTags[0] != null
        ? formatFocusAreaLabel(strengthTags[0])
        : profile?.strongestCategories?.[0]
          ? formatFocusAreaLabel(profile.strongestCategories[0])
          : null;

    const repeatedWeaknesses = weaknessTags
      .filter((w) => w.count >= 2 || w.severity === 'high')
      .slice(0, 4)
      .map((w) => weaknessLabel(w.tag));

    const toneProfile = resolveInterviewerToneProfile({
      averageAnswerScore: profile?.averageAnswerScore,
      improvementTrendScore: profile?.improvementTrendScore ?? progress?.trend.improvementVelocity,
      recommendedDifficulty: profile?.recommendedDifficulty,
      sessionDifficulty: difficultyLevel,
    });

    return {
      weaknessTags,
      strengthTags,
      coachingTips,
      difficultyLevel,
      preferredDifficulty,
      improvementTrendScore: profile?.improvementTrendScore ?? null,
      averageAnswerScore: profile?.averageAnswerScore ?? 0,
      improvementVelocity: progress?.trend.improvementVelocity ?? 0,
      sessionCount: progress?.trend.sessionCount ?? 0,
      primaryFocusArea,
      strongestSkillArea,
      repeatedWeaknesses,
      sessionAdaptation: adaptation ?? null,
      previousComparison: comparison ?? null,
      toneProfile,
      toneAdjustments: interviewerToneAdjustments(toneProfile),
      isLoading: profileQ.isLoading || progressQ.isLoading,
    };
  }, [
    enrichedQ.data?.adaptation,
    enrichedQ.data?.previousSessionComparison,
    profileQ.data,
    profileQ.isLoading,
    progressQ.data,
    progressQ.isLoading,
    session?.weaknessSnapshot?.weaknesses,
  ]);

  return memory;
}

/** Build coaching card payload from turn response or memory fallback. */
export function resolveTurnCoaching(
  coaching: TurnCoaching | undefined | null,
  memory: Pick<InterviewPersonaMemory, 'primaryFocusArea' | 'coachingTips'>,
): TurnCoaching | null {
  if (coaching?.tip?.trim()) {
    return {
      message: coaching.message?.trim() || 'Nice work — here is how to sharpen the next answer.',
      tip: coaching.tip.trim(),
      focusArea: coaching.focusArea?.trim() || memory.primaryFocusArea || 'general',
    };
  }
  if (!memory.coachingTips.length && !memory.primaryFocusArea) return null;
  return {
    message: 'Keep building on this momentum.',
    tip:
      memory.coachingTips[0] ??
      'Add a specific example with a measurable outcome in your next answer.',
    focusArea: memory.primaryFocusArea ?? 'structure',
  };
}

export { INTERVIEW_ADAPTIVE_PROFILE_KEY, INTERVIEW_PREP_PROGRESS_KEY };
