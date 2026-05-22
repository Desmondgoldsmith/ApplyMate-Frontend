/**
 * Mode-based atmosphere: spacing, motion feel, emphasis — not more widgets.
 */

export type AssistantModeAtmosphere = {
  /** Section stack gap (Tailwind gap-*). */
  sectionGapClass: string;
  /** Hero title scale. */
  heroTitleClass: string;
  /** Framer motion transition (calm vs energetic). */
  motionTransition: { duration: number; ease: number[] };
  /** Insight cards slightly quieter in recovery. */
  insightDensity: 'sparse' | 'normal' | 'rich';
};

export function atmosphereForMode(mode: string | null): AssistantModeAtmosphere {
  const m = (mode ?? "").toUpperCase();
  if (m.includes("RECOVERY")) {
    return {
      sectionGapClass: "gap-10",
      heroTitleClass: "text-[21px] sm:text-[24px] font-semibold leading-snug tracking-tight text-white/92",
      motionTransition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] },
      insightDensity: "sparse",
    };
  }
  if (m.includes("INTERVIEW")) {
    return {
      sectionGapClass: "gap-7",
      heroTitleClass: "text-[23px] sm:text-[27px] font-semibold leading-[1.2] tracking-tight text-white",
      motionTransition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
      insightDensity: "sparse",
    };
  }
  if (m.includes("SPRINT") || m.includes("APPLICATION")) {
    return {
      sectionGapClass: "gap-7",
      heroTitleClass: "text-[22px] sm:text-[26px] font-semibold leading-snug text-white",
      motionTransition: { duration: 0.28, ease: [0.33, 0.66, 0.34, 1] },
      insightDensity: "normal",
    };
  }
  return {
    sectionGapClass: "gap-8",
    heroTitleClass: "text-[22px] sm:text-[26px] font-semibold leading-snug text-white",
    motionTransition: { duration: 0.38, ease: [0.21, 0.47, 0.32, 0.98] },
    insightDensity: "normal",
  };
}
