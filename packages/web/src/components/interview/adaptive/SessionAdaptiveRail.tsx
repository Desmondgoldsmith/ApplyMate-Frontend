'use client';

import { memo, useMemo } from 'react';

import { AdaptiveDifficultyBadge } from '@/components/interview/adaptive/AdaptiveDifficultyBadge';
import { AdaptiveTransitionNotice } from '@/components/interview/adaptive/AdaptiveTransitionNotice';
import { InterviewerBehaviorIndicator } from '@/components/interview/adaptive/InterviewerBehaviorIndicator';
import { InterviewProgressEvolutionGraph } from '@/components/interview/adaptive/InterviewProgressEvolutionGraph';
import { WeakAreaIndicatorPanel } from '@/components/interview/adaptive/WeakAreaIndicatorPanel';
import {
  resolveInterviewerBehaviorMode,
  type SessionAdaptiveSnapshot,
  type SkillEvolutionPoint,
} from '@/lib/interviewAdaptive';
import { cn } from '@/lib/utils';

export type SessionAdaptiveRailProps = {
  snapshot: SessionAdaptiveSnapshot;
  evolutionHistory: SkillEvolutionPoint[];
  showEvolution?: boolean;
  difficultyPulse?: boolean;
  className?: string;
};

/**
 * Shows at most 1–2 adaptive signals — difficulty badge + one panel OR behavior.
 */
export const SessionAdaptiveRail = memo(function SessionAdaptiveRail({
  snapshot,
  evolutionHistory,
  showEvolution = false,
  difficultyPulse = false,
  className,
}: SessionAdaptiveRailProps) {
  const difficulty =
    snapshot.session?.recommendedDifficulty ??
    snapshot.profile?.recommendedDifficulty ??
    'medium';

  const behaviorMode = useMemo(
    () =>
      resolveInterviewerBehaviorMode(
        snapshot.session?.recommendedDifficulty,
        snapshot.session?.nextQuestionType,
      ),
    [snapshot.session?.nextQuestionType, snapshot.session?.recommendedDifficulty],
  );

  const showWeakPanel = Boolean(snapshot.profile?.weakAreas?.length);
  const showBehavior = snapshot.session?.recommendedDifficulty === 'hard' || behaviorMode !== 'calm';

  return (
    <div className={cn('mx-5 space-y-2 pt-3', className)} aria-label="Adaptive interview">
      <div className="flex flex-wrap items-center gap-2">
        <AdaptiveDifficultyBadge level={difficulty} showPulse={difficultyPulse} />
        <span className="text-[10px] text-[var(--text-muted)]">Adapting to you</span>
      </div>

      <AdaptiveTransitionNotice message={snapshot.transitionMessage} />

      {showWeakPanel ? <WeakAreaIndicatorPanel profile={snapshot.profile} /> : null}

      {!showWeakPanel && showBehavior ? (
        <InterviewerBehaviorIndicator mode={behaviorMode} />
      ) : null}

      {showEvolution && evolutionHistory.length >= 2 ? (
        <InterviewProgressEvolutionGraph history={evolutionHistory} compact />
      ) : null}
    </div>
  );
});
