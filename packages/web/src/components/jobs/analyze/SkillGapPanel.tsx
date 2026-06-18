'use client';

import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkillTierBadge } from '@/components/job-analysis/SkillTierBadge';
import { RequirementKindBadge } from '@/components/job-analysis/RequirementKindBadge';
import {
  CV_TAILOR_ONE_AI_USE_NOTE,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
} from '@/lib/ai-daily-usage';
import type { JobAnalysis } from '@/lib/api';
import { getGapDisplaySkills } from '@/lib/skillCoverage';
import { resolveTailorUiState } from '@/lib/tailorAnalysisUi';
import { cn } from '@/lib/utils';

type MissingSkill = NonNullable<JobAnalysis['missingSkills']>[number];

export type SkillGapPanelProps = {
  analysis: JobAnalysis;
  isTailorComplete: boolean;
  selectedSkillNames: string[];
  onToggleSkill: (name: string) => void;
  tailorSubmitting: boolean;
  jobAnalysisIdForTailor: string;
  cvProfileIdForTailor: string;
  cvBootstrapPending: boolean;
  cvProfileCount: number;
  selectedProfileId: string | null;
  tailorAiBlocked: boolean;
  hasTailorDraftForJob: boolean;
  onCreateTailorDraft: () => void;
  onResumeTailoring: () => void;
  onOpenTailorEditor: () => void;
};

/** Skill gap checklist and tailor CTA — never blocked solely by empty `missingSkills`. */
export function SkillGapPanel({
  analysis,
  isTailorComplete,
  selectedSkillNames,
  onToggleSkill,
  tailorSubmitting,
  jobAnalysisIdForTailor,
  cvProfileIdForTailor,
  cvBootstrapPending,
  cvProfileCount,
  selectedProfileId,
  tailorAiBlocked,
  hasTailorDraftForJob,
  onCreateTailorDraft,
  onResumeTailoring,
  onOpenTailorEditor,
}: SkillGapPanelProps) {
  const tailorUi = resolveTailorUiState(analysis, hasTailorDraftForJob);
  const missingSkills = getGapDisplaySkills(analysis);
  const showGapChecklist =
    !isTailorComplete &&
    tailorUi.tailorCtaMode === 'start' &&
    missingSkills.length > 0;

  if (isTailorComplete) {
    return null;
  }

  const handlePrimaryCta = () => {
    if (tailorUi.tailorCtaMode === 'view') {
      onOpenTailorEditor();
      return;
    }
    if (tailorUi.tailorCtaMode === 'continue') {
      onResumeTailoring();
      return;
    }
    onCreateTailorDraft();
  };

  const primaryDisabled =
    !tailorUi.tailorEditorOpenable ||
    tailorSubmitting ||
    !jobAnalysisIdForTailor ||
    (tailorUi.tailorCtaMode === 'start' &&
      (selectedSkillNames.length === 0 ||
        (!cvProfileIdForTailor && !cvBootstrapPending) ||
        (cvProfileCount > 1 && !selectedProfileId))) ||
    tailorAiBlocked;

  return (
    <>
      <h3 className="mb-3 text-sm font-semibold text-white">
        Tailor your CV to this job
      </h3>

      {showGapChecklist ? (
        <>
          <p className="mb-3 text-xs text-white/50">
            Select which gaps to address. Critical and high-importance skills are
            pre-selected.
          </p>
          <div className="flex flex-col gap-2">
            {missingSkills.map((skill: MissingSkill) => {
              const checked = selectedSkillNames.includes(skill.name);
              const badgeVariant =
                skill.importance === 'CRITICAL' || skill.importance === 'HIGH'
                  ? 'red'
                  : skill.importance === 'MEDIUM'
                    ? 'amber'
                    : 'muted';
              return (
                <label
                  key={skill.name}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                    checked
                      ? 'border-[#00C9B1]/35 bg-[rgba(0,201,177,0.07)]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/15',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-white/20 bg-[#111616] text-[#00C9B1] focus:ring-[#00C9B1]/40"
                    checked={checked}
                    onChange={() => onToggleSkill(skill.name)}
                  />
                  <span className="min-w-0 flex-1 text-sm text-white/90">
                    {skill.name}
                  </span>
                  <RequirementKindBadge kind={skill.requirementKind} />
                  <SkillTierBadge tier={skill.tier} />
                  <Badge variant={badgeVariant}>{skill.importance}</Badge>
                </label>
              );
            })}
          </div>
        </>
      ) : tailorUi.tailorCtaMode !== 'start' ? (
        <p className="mb-3 text-xs text-white/50">
          {tailorUi.tailorCtaMode === 'continue'
            ? 'Pick up where you left off — remaining sections are still open in the tailor editor.'
            : 'Your tailored CV is saved. Open the editor to review changes or export.'}
        </p>
      ) : missingSkills.length === 0 ? (
        <p className="mb-3 text-xs text-white/50">
          No skill gaps were returned, but you can still tailor summary, experience, and other sections for this role.
        </p>
      ) : null}

      {tailorUi.tailorEditorOpenable ? (
        <Button
          type="button"
          fullWidth
          className="mt-1 gap-2"
          disabled={primaryDisabled}
          title={
            !jobAnalysisIdForTailor
              ? 'This analysis is not linked to a saved job record yet. Open this job from Recent analyses, or Clear form and run Analyze again.'
              : tailorAiBlocked
                ? DAILY_AI_LIMIT_REACHED_MESSAGE
                : tailorUi.tailorCtaMode === 'start' && cvProfileCount > 1 && !selectedProfileId
                  ? 'Choose which CV to tailor in the dropdown above.'
                  : tailorUi.tailorCtaMode === 'start' && !cvProfileIdForTailor && !cvBootstrapPending
                    ? 'Upload or select a CV profile first.'
                    : tailorUi.tailorCtaMode === 'start' && selectedSkillNames.length === 0
                      ? 'Select at least one skill gap to tailor toward.'
                      : undefined
          }
          onClick={handlePrimaryCta}
        >
          {tailorSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="text-base leading-none" aria-hidden>
              ✦
            </span>
          )}
          {tailorSubmitting ? 'Tailoring…' : tailorUi.tailorCtaLabel}
        </Button>
      ) : null}

      {tailorUi.tailorCtaMode === 'start' ? (
        <p className="mt-2 text-[11px] leading-snug text-white/40">
          {CV_TAILOR_ONE_AI_USE_NOTE}
        </p>
      ) : null}

      {!jobAnalysisIdForTailor ? (
        <p className="mt-2 text-xs text-amber-200/85">
          Tailoring needs a saved job id. We try to attach it from Recent
          analyses automatically. If this stays disabled, click this job in
          the list on the left, or use{' '}
          <span className="font-semibold text-white/90">Clear form</span> and run{' '}
          <span className="font-semibold text-white/90">Analyze Job</span> once
          more.
        </p>
      ) : null}
    </>
  );
}
