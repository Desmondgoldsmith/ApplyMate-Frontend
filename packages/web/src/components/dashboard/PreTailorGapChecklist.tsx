'use client';

import { useMemo } from 'react';

import type { JobAnalysis } from '@/lib/api';

export type TailorMissingSkill = NonNullable<JobAnalysis['missingSkills']>[number];

function sectionTitle(sectionType: string): string {
  const s = sectionType?.trim() || 'section';
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} section`;
}

function normalizeMissingSkillLabel(entry: TailorMissingSkill): string {
  return entry.name?.trim() ?? '';
}

export function PreTailorGapChecklist({
  missingSkills,
  selectedSkills,
  plannedSections,
}: {
  missingSkills: TailorMissingSkill[];
  selectedSkills: string[];
  plannedSections?: string[];
}) {
  const selectedLower = useMemo(
    () => new Set(selectedSkills.map((s) => s.trim().toLowerCase()).filter(Boolean)),
    [selectedSkills],
  );
  const openGaps = useMemo(
    () =>
      missingSkills
        .map(normalizeMissingSkillLabel)
        .filter((skill) => skill.length > 0 && !selectedLower.has(skill.toLowerCase())),
    [missingSkills, selectedLower],
  );
  const sections = plannedSections?.filter(Boolean) ?? [];

  if (openGaps.length === 0 && sections.length === 0) return null;

  return (
    <div
      className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3"
      data-testid="tailor-pre-gap-checklist"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
        Before you review changes
      </p>
      {openGaps.length > 0 ? (
        <>
          <p className="mt-2 text-[12px] leading-relaxed text-white/60">
            Skill gaps from the job analysis. Selected skills will be reflected in the draft below.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {openGaps.slice(0, 24).map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100/90"
              >
                {skill}
              </span>
            ))}
          </div>
        </>
      ) : null}
      {sections.length > 0 ? (
        <p className="mt-2 text-[11px] text-white/45">
          Planned sections:{' '}
          {sections.map((st) => sectionTitle(st)).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
