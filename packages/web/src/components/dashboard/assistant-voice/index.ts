export {
  humanizeEnumLabel,
  humanizeNarrativeArc,
  humanizeReasoningSignal,
  maybeWarnInvalidHumanExperienceCopy,
  safeHumanText,
  stripTechnicalTokens,
  shouldHideAsRawMetric,
  validateHumanExperienceCopy,
} from '@/components/dashboard/assistant-voice/humanize';
export {
  composeArcPresenceLine,
  composeHeroSecondary,
  composeInternalStateWhisper,
} from '@/components/dashboard/assistant-voice/narrative';
export { pickReassuranceLine } from '@/components/dashboard/assistant-voice/reassurance';
export { atmosphereForMode } from '@/components/dashboard/assistant-voice/atmosphere';
export type { AssistantModeAtmosphere } from '@/components/dashboard/assistant-voice/atmosphere';
export { insightKindLabel } from '@/components/dashboard/assistant-voice/insightVoice';
export { assistantToneFromMode } from '@/components/dashboard/assistant-voice/tone';
export type { AssistantTone } from '@/components/dashboard/assistant-voice/tone';
export { sectionPacingClass } from '@/components/dashboard/assistant-voice/pacing';
export { MAX_HERO_SECONDARY_SENTENCES, MAX_INSIGHT_BODY_LINES } from '@/components/dashboard/assistant-voice/calmness';
export { recoveryEncouragementKind } from '@/components/dashboard/assistant-voice/recoveryEncouragement';
export type { RecoveryEncouragementKind } from '@/components/dashboard/assistant-voice/recoveryEncouragement';
export { assistantToneHeroAccentClass, assistantToneStripClass } from '@/components/dashboard/assistant-voice/assistantToneStyles';
export {
  continuationEyebrowLabel,
  dashboardWelcomeLine,
  readLastDashboardOpenMs,
  writeDashboardOpenedNow,
} from '@/components/dashboard/assistant-voice/microMemory';
