'use client';

import {
  CvClinicWorkspace,
  type CvClinicWorkspaceProps,
} from '@/components/cv/CvClinicWorkspace';

export type OnboardingResumeClinicProps = Omit<
  CvClinicWorkspaceProps,
  'builderContext'
> & {
  onBack: NonNullable<CvClinicWorkspaceProps['onBack']>;
  onContinue: NonNullable<CvClinicWorkspaceProps['onContinue']>;
  onSkip: NonNullable<CvClinicWorkspaceProps['onSkip']>;
};

/** Onboarding resume editor — same {@link CvClinicWorkspace} shell as CV Clinic. */
export function OnboardingResumeClinic(props: OnboardingResumeClinicProps) {
  return <CvClinicWorkspace builderContext="onboarding" {...props} />;
}
