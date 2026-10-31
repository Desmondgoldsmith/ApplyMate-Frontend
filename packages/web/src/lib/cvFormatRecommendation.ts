import type { CareerStage } from '@/lib/api';
import type { CvTemplateId } from '@/lib/cvBuilder';

export type CvFormatRecommendation = {
  label: string;
  recommended: CvTemplateId;
  reason: string;
};

const BY_STAGE: Record<CareerStage, CvFormatRecommendation> = {
  student: {
    label: 'Student or first job',
    recommended: 'modern',
    reason:
      'Modern puts your skills and education first, which helps when you have little work history.',
  },
  early: {
    label: 'Early career (0–3 years)',
    recommended: 'modern',
    reason: 'Show your skills clearly next to your experience.',
  },
  mid: {
    label: 'Mid career (3–8 years)',
    recommended: 'classic',
    reason: 'Lead with your work history. It is your strongest asset.',
  },
  senior: {
    label: 'Senior (8+ years)',
    recommended: 'professional',
    reason:
      'A structured layout that shows your seniority and specialist skills.',
  },
};

function isCareerStage(v: unknown): v is CareerStage {
  return v === 'student' || v === 'early' || v === 'mid' || v === 'senior';
}

/** Stage from job count, for when the CV has not been scored yet. */
function stageFromJobCount(count: number): CareerStage {
  if (count === 0) return 'student';
  if (count <= 2) return 'early';
  if (count <= 5) return 'mid';
  return 'senior';
}

/**
 * Template advice for the user's career stage. Uses the score's stage (based on
 * years of experience) so the advice never contradicts the score card.
 */
export function getFormatRecommendation(opts: {
  careerStage?: unknown;
  experienceCount: number;
}): CvFormatRecommendation {
  const stage = isCareerStage(opts.careerStage)
    ? opts.careerStage
    : stageFromJobCount(opts.experienceCount);
  return BY_STAGE[stage];
}
