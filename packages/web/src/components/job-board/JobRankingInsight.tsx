'use client';

import { Check, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, type JobListingDto, type JobRankingTier } from '@/lib/api';
import { cn } from '@/lib/utils';

export type JobDecision = 'APPLY' | 'MAYBE' | 'SKIP';

const TIER_LABEL: Record<JobRankingTier, string> = {
  APPLY_NOW: 'Apply now',
  CONSIDER: 'Consider',
  LOW_MATCH: 'Low match',
};

const TIER_CLASS: Record<JobRankingTier, string> = {
  APPLY_NOW: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  CONSIDER: 'border-amber-400/35 bg-amber-500/10 text-amber-100',
  LOW_MATCH: 'border-white/15 bg-white/5 text-white/50',
};

const SENIORITY_COPY: Record<string, string> = {
  under: 'This role may expect more senior experience than your profile suggests.',
  over: 'This role may be below your current seniority level.',
  unknown: 'Seniority fit could not be determined from the listing.',
};

function TierBadge({ tier, score }: { tier: JobRankingTier; score?: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        TIER_CLASS[tier],
      )}
    >
      {TIER_LABEL[tier]}
      {typeof score === 'number' ? <span className="font-medium opacity-90">· {score}%</span> : null}
    </span>
  );
}

function SkillChips({ title, skills, tone }: { title: string; skills: string[]; tone: 'match' | 'gap' }) {
  if (skills.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span
            key={skill}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              tone === 'match'
                ? 'border-[#00C9B1]/30 bg-[#00C9B1]/10 text-[#8af3e7]'
                : 'border-white/12 bg-white/[0.04] text-white/55',
            )}
          >
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}

export function JobRankingInsight({ job }: { job: JobListingDto }) {
  const toast = useToast();
  const ranking = job.ranking;
  const explanation = job.explanation;
  const [decision, setDecision] = useState<JobDecision | null>(null);

  const recordDecision = useMutation({
    mutationFn: (next: JobDecision) => api.jobDiscovery.recordDecision(job.id, next),
    onSuccess: (_data, next) => {
      setDecision(next);
    },
    onError: () => {
      toast.error('Could not save your choice. Try again in a moment.');
    },
  });

  const onDecision = useCallback(
    (next: JobDecision) => {
      if (decision === next) return;
      recordDecision.mutate(next);
    },
    [decision, recordDecision],
  );

  if (!ranking && !explanation) return null;

  const matched = (explanation?.matchedSkills ?? []).slice(0, 12);
  const missing = (explanation?.missingSkills ?? []).slice(0, 10);
  const risks = (explanation?.riskFactors ?? []).slice(0, 5);
  const seniority = explanation?.seniorityMismatch;
  const seniorityNote =
    seniority && seniority !== 'none' ? SENIORITY_COPY[seniority] ?? null : null;
  const refinedScore = job.matchPreview?.refinedScore;
  const showAiVerified =
    job.matchPreview?.refinedReady === true &&
    typeof refinedScore === 'number' &&
    Number.isFinite(refinedScore);

  return (
    <section
      className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
      aria-labelledby={`job-ranking-${job.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 id={`job-ranking-${job.id}`} className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
            Why this job
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {ranking?.tier ? <TierBadge tier={ranking.tier} score={ranking.score} /> : null}
            {showAiVerified ? (
              <span className="rounded-full border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#8af3e7]">
                AI verified · {Math.round(refinedScore)}%
              </span>
            ) : null}
          </div>
          {ranking?.recommendation ? (
            <p className="text-[13px] font-medium leading-snug text-[#8af3e7]/90">{ranking.recommendation}</p>
          ) : null}
        </div>
      </div>

      {explanation?.whyThisJob ? (
        <p className="text-[13px] leading-[1.65] text-white/70">{explanation.whyThisJob}</p>
      ) : null}

      {explanation?.recommendation && explanation.recommendation !== ranking?.recommendation ? (
        <p className="text-[12px] leading-relaxed text-white/50">{explanation.recommendation}</p>
      ) : null}

      <SkillChips title="Skills you match" skills={matched} tone="match" />
      <SkillChips title="Gaps to address" skills={missing} tone="gap" />

      {risks.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Watch outs</h4>
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-amber-100/85">
            {risks.map((risk) => (
              <li key={risk} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {seniorityNote ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-white/55">
          {seniorityNote}
        </p>
      ) : null}

      <div className="border-t border-white/[0.06] pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
          Your decision
        </p>
        <div className="flex flex-wrap gap-2">
          <DecisionButton
            label="Apply"
            active={decision === 'APPLY'}
            pending={recordDecision.isPending && recordDecision.variables === 'APPLY'}
            onClick={() => onDecision('APPLY')}
            className="border-emerald-400/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            icon={<ThumbsUp className="h-3.5 w-3.5" aria-hidden />}
          />
          <DecisionButton
            label="Maybe"
            active={decision === 'MAYBE'}
            pending={recordDecision.isPending && recordDecision.variables === 'MAYBE'}
            onClick={() => onDecision('MAYBE')}
            className="border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
            icon={<Check className="h-3.5 w-3.5" aria-hidden />}
          />
          <DecisionButton
            label="Skip"
            active={decision === 'SKIP'}
            pending={recordDecision.isPending && recordDecision.variables === 'SKIP'}
            onClick={() => onDecision('SKIP')}
            className="border-white/15 bg-white/[0.04] text-white/60 hover:bg-white/[0.06]"
            icon={<ThumbsDown className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
        {decision ? (
          <p className="mt-2 text-[11px] text-white/40" role="status">
            Saved — we will use this to personalize future recommendations.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-white/40">
            Quick feedback helps us surface better matches. This does not change your ranking score.
          </p>
        )}
      </div>
    </section>
  );
}

function DecisionButton({
  label,
  active,
  pending,
  onClick,
  className,
  icon,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  className: string;
  icon: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={onClick}
      className={cn(
        'h-10 min-h-[40px] gap-1.5 rounded-lg border px-3 text-[12px] font-semibold',
        active && 'ring-1 ring-[#00C9B1]/40',
        className,
      )}
      aria-pressed={active}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icon}
      {label}
    </Button>
  );
}
