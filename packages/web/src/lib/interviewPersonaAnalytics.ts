import { enqueueInterviewAnalyticsEvent } from '@/lib/interviewAnalyticsBatch';
import type { InterviewPersonaId } from '@/lib/interviewPersonas';

type PersonaAnalyticsPayload = {
  sessionId: string;
  personality: InterviewPersonaId;
  mode?: string;
};

/** Maps to backend-allowed `interview_started` (personality_viewed is not ingested). */
export function trackInterviewPersonalityViewed(payload: PersonaAnalyticsPayload) {
  enqueueInterviewAnalyticsEvent({
    eventName: 'interview_started',
    sessionId: payload.sessionId,
    context: {
      personality: payload.personality,
      mode: payload.mode,
      analyticsSurface: 'personality_viewed',
    },
  });
}

export function trackInterviewPersonalityEffectObserved(
  payload: PersonaAnalyticsPayload & { effect?: string; turnId?: string },
) {
  const effect = payload.effect?.trim().toLowerCase();
  const eventName =
    effect === 'interruption' || effect === 'weakness'
      ? 'interview_weakness_detected'
      : effect === 'follow_up' || effect === 'followup'
        ? 'interview_followup_triggered'
        : null;

  if (!eventName) return;

  enqueueInterviewAnalyticsEvent({
    eventName,
    sessionId: payload.sessionId,
    context: {
      personality: payload.personality,
      mode: payload.mode,
      effect: payload.effect,
      turnId: payload.turnId,
      analyticsSurface: 'personality_effect_observed',
    },
  });
}
