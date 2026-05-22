'use client';

import { memo } from 'react';

import { RealInterviewModeIndicator } from '@/components/interview/RealInterviewModeIndicator';
import { InterruptionAlertBanner } from '@/components/interview/simulation/InterruptionAlertBanner';
import { InterviewPersonaLiveIndicator } from '@/components/interview/simulation/InterviewPersonaLiveIndicator';
import { InterviewPressureMeter } from '@/components/interview/simulation/InterviewPressureMeter';
import type { useInterviewSimulationExperience } from '@/hooks/useInterviewSimulationExperience';
import type { InterviewEmotion } from '@/lib/interview-prep-types';

type SimExperience = ReturnType<typeof useInterviewSimulationExperience>;

export type SimulationPanelProps = {
  isSimSession: boolean;
  showAdaptiveBadge: boolean;
  interviewSim: SimExperience;
  interruptionBannerVisible: boolean;
  interruptionBannerMessage: string | null;
  pressureLabel?: string;
};

export const SimulationPanel = memo(function SimulationPanel({
  isSimSession,
  showAdaptiveBadge,
  interviewSim,
  interruptionBannerVisible,
  interruptionBannerMessage,
  pressureLabel,
}: SimulationPanelProps) {
  if (!isSimSession) return null;

  return (
    <>
      <RealInterviewModeIndicator
        className="mt-1"
        emotionActive={interviewSim.active}
        adaptiveActive={showAdaptiveBadge}
        pressureActive={interviewSim.active}
      />
      {interviewSim.active && interviewSim.personaUi ? (
        <div className="mx-5 mt-2 space-y-2">
          <InterviewPersonaLiveIndicator
            persona={interviewSim.personaUi}
            emotion={interviewSim.emotion as InterviewEmotion}
          />
          <InterviewPressureMeter
            intensity={interviewSim.displayPressureIntensity}
            tier={interviewSim.pressureTier}
            visible={interviewSim.showPressureMeter}
          />
          <InterruptionAlertBanner
            message={interruptionBannerMessage}
            visible={interruptionBannerVisible}
          />
        </div>
      ) : null}
      {pressureLabel ? (
        <p className="text-center text-[11px] font-semibold text-amber-200/90">{pressureLabel}</p>
      ) : null}
    </>
  );
});
