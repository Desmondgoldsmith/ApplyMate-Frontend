'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { InfoHint } from '@/components/ui/InfoHint';
import { TOOLTIP_GOAL_ALIGNMENT } from '@/lib/dashboardIntelligenceTooltips';
import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import type { CareerGoalProfilePayload, GoalAlignmentPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  alignment: GoalAlignmentPayload;
  careerProfile?: CareerGoalProfilePayload | null;
};

function Chip({ children, variant }: { children: ReactNode; variant: 'strong' | 'gap' }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full rounded-lg border px-2.5 py-1 text-[11px] leading-snug',
        variant === 'strong'
          ? 'border-[#00C9B1]/35 bg-[#00C9B1]/[0.08] text-[#9CF5EA]/88'
          : 'border-amber-400/28 bg-amber-400/[0.06] text-amber-100/85',
      )}
    >
      {children}
    </span>
  );
}

export function DashboardGoalAlignmentCard({ alignment, careerProfile }: Props) {
  const headline = alignment.headline?.trim() || '';
  const supporting = alignment.supporting?.trim() || '';

  const score =
    typeof alignment.score === 'number' && Number.isFinite(alignment.score)
      ? Math.max(0, Math.min(100, Math.round(alignment.score)))
      : null;

  const strongest = alignment.strongestSignals ?? [];
  const gaps = alignment.gapSignals ?? [];

  const displayHeadline =
    headline === 'Goals and pipeline are only partially aligned.'
      ? 'Your applications aren\'t fully matching your stated goals yet.'
      : headline;

  if (score == null && !headline && !supporting && strongest.length === 0 && gaps.length === 0) return null;

  const profile = careerProfile ?? null;

  const profileHasTargets = Boolean(
    profile &&
      (profile.targetRoles.length > 0 ||
        profile.technologies.length > 0 ||
        profile.targetLocations.length > 0 ||
        profile.preferredCompanies.length > 0 ||
        profile.seniorityGoal ||
        profile.timelineGoal?.trim()),
  );

  const hasSignalsColumn = strongest.length > 0 || gaps.length > 0 || profileHasTargets;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3.5 shadow-[0_22px_52px_-34px_rgba(0,0,0,0.52)] ring-1 ring-white/[0.05] sm:p-6">
      <div className="grid grid-cols-1 gap-8">
        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium tracking-wide text-white/38">Jobs matching your goals</p>
              <InfoHint text={TOOLTIP_GOAL_ALIGNMENT} buttonAriaLabel="About jobs matching your goals" />
            </div>
            {score != null ? (
              <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-white/95">
                {score}
                <span className="text-[15px] font-medium text-white/45">/100</span>
              </p>
            ) : null}
          </div>

          {score != null ? (
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/85 to-[#9CF5EA]/55"
                style={{ width: `${score}%` }}
              />
            </div>
          ) : null}

          {displayHeadline ? (
            <h2 className="text-[16px] font-semibold leading-snug text-white/92">{sanitizeDashboardDisplayText(displayHeadline)}</h2>
          ) : null}
          {supporting ? <p className="text-[13px] leading-relaxed text-white/58">{sanitizeDashboardDisplayText(supporting)}</p> : null}
        </div>

        {hasSignalsColumn ? (
          <div className="min-w-0 space-y-5 border-t border-white/[0.06] pt-8">
          {strongest.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                What&apos;s working for alignment
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {strongest.map((s, i) => (
                  <Chip key={`strong-${i}-${s}`} variant="strong">
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {gaps.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                What&apos;s pulling you off target
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {gaps.map((s, i) => (
                  <Chip key={`gap-${i}-${s}`} variant="gap">
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {alignment.ctaLabel?.trim() && alignment.ctaHref?.trim() ? (
            <div className="border-t border-white/[0.06] pt-6">
              <Link
                href={alignment.ctaHref.trim()}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A] sm:w-auto"
              >
                {alignment.ctaLabel.trim()}
              </Link>
            </div>
          ) : null}

          {profileHasTargets && profile ? (
            <div className="border-t border-white/[0.06] pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Your targets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.targetRoles.map((r) => (
                  <Chip key={`tr-${r}`} variant="strong">
                    {r}
                  </Chip>
                ))}
                {profile.technologies.map((t) => (
                  <span
                    key={`tech-${t}`}
                    className="inline-flex rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55"
                  >
                    {t}
                  </span>
                ))}
                {profile.targetLocations.map((t) => (
                  <span
                    key={`loc-${t}`}
                    className="inline-flex rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55"
                  >
                    {t}
                  </span>
                ))}
                {profile.preferredCompanies.map((c) => (
                  <span
                    key={`co-${c}`}
                    className="inline-flex rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55"
                  >
                    {c}
                  </span>
                ))}
                {profile.seniorityGoal ? (
                  <span className="inline-flex rounded-lg border border-white/12 px-2.5 py-1 text-[11px] capitalize text-white/55">
                    {profile.seniorityGoal}
                  </span>
                ) : null}
                {profile.timelineGoal?.trim() ? (
                  <span className="inline-flex rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/55">
                    {profile.timelineGoal.trim()}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
