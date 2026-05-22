import {
  effectiveContinuationRecommendationId,
  effectiveHeroRecommendationId,
  orchestratedRowByRecommendationId,
} from '@/lib/dashboardOrchestrationModel';
import { ensureSafeDashboardHref, resolveExecutionDestination } from '@/lib/executionRouting';
import type {
  ContinuationContextPayload,
  DashboardExperienceActionSurface,
  DashboardExperiencePayload,
  ExperiencePipelineSnapshot,
  PersonalizationContextPayload,
  TodayPlanPayload,
} from '@/lib/today-plan';

export type DashboardHeroView = {
  recommendationId: string | null;
  title: string;
  subtitle: string | null;
  href: string | null;
  ctaLabel: string | null;
  /** Coaching line under the primary CTA (e.g. personalized next-best-action copy). */
  ctaHelper: string | null;
  minutes: number | null;
  /** When false, skip loud primary CTA (informational intensity or missing route). */
  showPrimaryCta: boolean;
  arcLabel: string | null;
  emotionalTone: string | null;
  expectedOutcome: string | null;
};

export type InsightDisclosureView = {
  reasoning: string | null;
  whyChanged: string | null;
  sinceYesterday: string | null;
  memoryMicrocopy: string | null;
};

export type InformationalSurfaceView = {
  /** Informational surface id from orchestration (e.g. exp-landscape); omit for synthetic rows. */
  surfaceId?: string | null;
  category: string;
  insightCategory: string | null;
  visualPriority: string | null;
  headline: string | null;
  body: string | null;
  supportingMetric: unknown | null;
  visualWeight: 'quiet' | 'normal';
  confidence: {
    recommendationConfidence: number | null;
    routingConfidence: number | null;
    workflowConfidence: number | null;
    continuityConfidence: number | null;
  } | null;
  /** Parsed from `supportingMetric` when backend sends structured disclosure fields. */
  disclosure: InsightDisclosureView | null;
};

export type DashboardContinuationView = {
  recommendationId: string | null;
  title: string;
  subtitle: string | null;
  href: string | null;
  ctaLabel: string | null;
  minutes: number | null;
  showPrimaryCta: boolean;
  interruptionAgeHours: number | null;
  remainingSteps: number | null;
  resumeConfidence: number | null;
  percentComplete: number | null;
  continuationContext: ContinuationContextPayload | null;
  /** Parsed job context for interview prep / role-specific flows (optional). */
  jobRoleTitle: string | null;
  jobCompanyName: string | null;
  confidence: {
    recommendationConfidence: number | null;
    routingConfidence: number | null;
    workflowConfidence: number | null;
    continuityConfidence: number | null;
  } | null;
};

export type PipelineMetricView = {
  key: string;
  label: string;
  value: number;
};

export type DashboardViewModel = {
  usesExperienceLayer: boolean;
  orchestrationVersion: number;
  mode: string | null;
  momentumLine: string | null;
  narrativeTone: string | null;
  personalizationContext: PersonalizationContextPayload | null;
  hero: DashboardHeroView | null;
  continuation: DashboardContinuationView | null;
  pipelineMetrics: PipelineMetricView[];
  informationalSurfaces: InformationalSurfaceView[];
  /** Prefer this order when filtering/sorting priority cards. */
  priorityOrderHint: string[];
  suppressedIds: ReadonlySet<string>;
  pipelineSnapshot: ExperiencePipelineSnapshot | null;
  maxPriorityCards: number;
  /** Hide legacy `nextStep` card when intelligence hero already owns the narrative. */
  suppressLegacyNextStep: boolean;
};

function findHeroSurface(exp: DashboardExperiencePayload): DashboardExperienceActionSurface | null {
  for (const s of exp.surfaces) {
    if (s.kind !== 'action') continue;
    if (s.category.trim().toLowerCase() === 'hero') return s;
  }
  return null;
}

function findContinuationSurface(exp: DashboardExperiencePayload): DashboardExperienceActionSurface | null {
  for (const s of exp.surfaces) {
    if (s.kind !== 'action') continue;
    if (s.category.trim().toLowerCase() === 'continuation') return s;
  }
  return null;
}

/** First server-authored non-empty string — preserves backend precedence for coaching copy. */
function pickFirstNonEmptyTrimmed(...parts: Array<string | null | undefined>): string {
  for (const p of parts) {
    if (typeof p !== 'string') continue;
    const t = p.trim();
    if (t) return t;
  }
  return '';
}

function isCompressedHeroValid(an: TodayPlanPayload['assistantNarrative']): boolean {
  const headline = an?.headline?.trim() ?? '';
  const supporting = an?.supporting?.trim() ?? '';
  const cta = an?.ctaLabel?.trim() ?? '';
  return Boolean(headline && supporting && cta);
}

// Phase 5A opportunityDetection is additive only (no hero override yet).

function disclosureFromSupportingMetric(metric: unknown): InsightDisclosureView | null {
  if (!metric || typeof metric !== 'object' || Array.isArray(metric)) return null;
  const m = metric as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const reasoning = str(m.reasoning ?? m.reasoningHint ?? m.explanation);
  const whyChanged = str(m.whyChanged ?? m.why_this_changed);
  const sinceYesterday = str(
    m.sinceYesterday ?? m.deltaSinceYesterday ?? m.whatChangedSinceYesterday ?? m.what_changed_since_yesterday,
  );
  const memoryMicrocopy = str(m.memoryMicrocopy ?? m.memory ?? m.microcopy);
  if (!reasoning && !whyChanged && !sinceYesterday && !memoryMicrocopy) return null;
  return { reasoning, whyChanged, sinceYesterday, memoryMicrocopy };
}

function jobContextFromResumeState(rs: Record<string, unknown> | null): { role: string | null; company: string | null } {
  if (!rs) return { role: null, company: null };
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const role =
    str(rs.roleTitle) ??
    str(rs.role_title) ??
    str(rs.jobTitle) ??
    str(rs.job_title) ??
    str(rs.title);
  const company =
    str(rs.companyName) ??
    str(rs.company_name) ??
    str(rs.company) ??
    str(rs.employer) ??
    str(rs.organization);
  return { role, company };
}

/** True when resume payload is backed by execution session semantics (not heuristic continuation). */
export function isExecutionSessionResume(plan: TodayPlanPayload | null | undefined): boolean {
  if (!plan?.resumeTarget?.resumeTarget?.trim()) return false;
  const src = String(plan.resumeTarget.continuationSource ?? '').trim().toLowerCase();
  if (src === 'execution_session') return true;
  if (!src && plan.activeExecutionSession === true) return true;
  return false;
}

function buildExecutionContinuationView(
  plan: TodayPlanPayload,
  exp: DashboardExperiencePayload | null,
): DashboardContinuationView | null {
  if (!isExecutionSessionResume(plan)) return null;
  const resume = plan.resumeTarget;
  if (!resume) return null;
  const resumeHref = resume.resumeTarget?.trim() || null;
  if (!resumeHref) return null;
  const continuationSurface = exp ? findContinuationSurface(exp) : null;
  const ctx = resume.continuationContext ?? null;
  const explicitRoute = continuationSurface?.actionRoute?.trim() || null;
  const resumeTitle = resume.title?.trim() || null;
  const titleFromApi =
    resumeTitle ||
    ctx?.taskLabel?.trim() ||
    continuationSurface?.narrativeTitle?.trim() ||
    null;
  const subtitleFromApi =
    continuationSurface?.narrativeSubtitle?.trim() ||
    ctx?.exactStepLabel?.trim() ||
    ctx?.detailedSummary?.trim() ||
    resume.resumeIntent?.trim() ||
    null;
  const surfaceCtx = continuationSurface?.continuationContext ?? null;
  const fromState = jobContextFromResumeState(resume.resumeState);
  const ac = plan.dashboardHeader?.actionContext;
  const hrefLower = (resumeHref ?? '').toLowerCase();
  const execLower = String(resume.executionType ?? '').toLowerCase();
  const intentLower = String(resume.resumeIntent ?? '').toLowerCase();
  const looksInterview =
    hrefLower.includes('/interview') ||
    execLower.includes('interview') ||
    intentLower.includes('interview');
  const workflowStep = String(plan.workflowProgress?.stepKey ?? '').trim().toLowerCase();
  const resumeStateObj =
    resume.resumeState !== null && typeof resume.resumeState === 'object'
      ? (resume.resumeState as Record<string, unknown>)
      : null;
  const evalStatus = String(
    resumeStateObj?.evaluationStatus ?? resumeStateObj?.evaluation_status ?? '',
  )
    .trim()
    .toLowerCase();
  if (looksInterview && evalStatus === 'completed' && workflowStep !== 'results_ready') {
    return null;
  }
  const headerRole = looksInterview ? ac?.roleTitle?.trim() || null : null;
  const headerCompany = looksInterview ? ac?.companyName?.trim() || null : null;
  const jobRoleTitle =
    pickFirstNonEmptyTrimmed(surfaceCtx?.roleTitle, ctx?.roleTitle, fromState.role, headerRole) || null;
  const jobCompanyName =
    pickFirstNonEmptyTrimmed(surfaceCtx?.companyName, ctx?.companyName, fromState.company, headerCompany) || null;
  const sessionIdMatch = resumeHref.match(/\/interview\/([^/?#]+)/i);
  const sessionId = sessionIdMatch?.[1]?.trim() ?? null;
  const resultsPath =
    typeof resumeStateObj?.resultsPath === 'string'
      ? resumeStateObj.resultsPath.trim()
      : typeof resumeStateObj?.results_path === 'string'
        ? resumeStateObj.results_path.trim()
        : '';
  const resultsHref =
    resultsPath || (sessionId ? `/dashboard/interview/${sessionId}` : resumeHref);

  let ctaLabel = (ctx?.taskLabel?.trim() || 'Continue').trim();
  let href = explicitRoute || resumeHref;
  let title = (titleFromApi || 'Your next step').trim();
  let subtitle = subtitleFromApi?.trim() || null;

  if (looksInterview && workflowStep === 'evaluation_processing') {
    title = titleFromApi || 'Interview results processing';
    subtitle =
      subtitle ||
      'Your answers are being scored in the background. This usually takes under a minute.';
    ctaLabel = 'Results processing…';
    href = resumeHref.includes('/dashboard') ? resumeHref : '/dashboard/continuation';
  } else if (looksInterview && workflowStep === 'results_ready') {
    title = titleFromApi || 'Interview results ready';
    subtitle = subtitle || 'Your scored feedback is ready to review.';
    ctaLabel = 'View results';
    href = resultsHref;
  }

  return {
    recommendationId: null,
    title,
    subtitle,
    href,
    ctaLabel,
    minutes: resume.estimatedRemainingMinutes ?? null,
    showPrimaryCta: true,
    interruptionAgeHours: plan.continuationState.interruptionAgeHours ?? null,
    remainingSteps: plan.continuationState.remainingSteps ?? null,
    resumeConfidence: resume.resumeConfidence ?? null,
    percentComplete: resume.percentComplete ?? null,
    continuationContext: ctx,
    jobRoleTitle,
    jobCompanyName,
    confidence: null,
  };
}

/** Short coaching line under the hero CTA when backend omits `personalizedNextBestAction`. */
function continuationCtaHelperLine(continuation: DashboardContinuationView | null): string | null {
  if (!continuation) return null;
  const sub = continuation.subtitle?.trim();
  if (sub) return sub.length > 160 ? `${sub.slice(0, 157)}…` : sub;
  const step = continuation.continuationContext?.exactStepLabel?.trim();
  if (step) return step.length > 160 ? `${step.slice(0, 157)}…` : step;
  return null;
}

function momentumLineFromPlan(plan: TodayPlanPayload, usesExperienceLayer: boolean): string | null {
  const exp = plan.dashboardExperience?.narrative;
  const dn = plan.dashboardNarrative;
  /** Intelligence layer: momentum copy comes from polished narrative only — not legacy dashboardHeader. */
  if (usesExperienceLayer) {
    return exp?.momentumCopy?.trim() || dn?.momentumCopy?.trim() || null;
  }
  return (
    exp?.momentumCopy?.trim() ||
    dn?.momentumCopy?.trim() ||
    plan.dashboardHeader?.momentumMessage?.trim() ||
    null
  );
}

export function buildDashboardViewModel(
  plan: TodayPlanPayload | null | undefined,
  options: { defaultCvProfileId?: string | null } = {},
): DashboardViewModel | null {
  if (!plan) return null;
  const exp = plan.dashboardExperience;
  const usesExperienceLayer = Boolean(
    plan.orchestrationVersion >= 2 &&
      exp &&
      exp.version >= 1 &&
      (exp.surfaces.length > 0 ||
        exp.visibleRecommendations.length > 0 ||
        exp.visibleRecommendationIds.length > 0 ||
        Boolean(exp.narrative.heroStory?.trim() || exp.narrative.momentumCopy?.trim())),
  );

  const momentumLine = momentumLineFromPlan(plan, usesExperienceLayer);
  const personalizationContext = plan.personalizationContext ?? null;
  const mode =
    plan.humanizedLabels?.strategicMode?.trim() ||
    exp?.narrative.mode?.trim() ||
    plan.dashboardNarrative?.strategicMode?.trim() ||
    null;
  const narrativeTone =
    exp?.narrative.narrativeTone?.trim() || plan.dashboardNarrative?.narrativeTone?.trim() || null;

  const suppressedIds = new Set(
    (exp?.suppressedRecommendationIds ?? []).map((id) => id.trim()).filter(Boolean),
  );

  let priorityOrderHint: string[] = [];
  if (usesExperienceLayer && exp) {
    const ids: string[] = [];
    for (const s of exp.surfaces) {
      if (s.kind !== 'action') continue;
      const vp = String(s.visualPriority ?? '')
        .trim()
        .toLowerCase();
      const cat = s.category.trim().toLowerCase();
      if (cat === 'hero' || cat === 'continuation') continue;
      if (vp !== 'primary') continue;
      const rid = (s.recommendationId ?? '').trim();
      if (rid) ids.push(rid);
    }
    if (ids.length > 0) priorityOrderHint = ids;
  }
  if (priorityOrderHint.length === 0) {
    if (exp?.visibleRecommendationIds?.length) {
      priorityOrderHint = [...exp.visibleRecommendationIds];
    } else if (exp?.visibleRecommendations?.length) {
      priorityOrderHint = exp.visibleRecommendations
        .map((r) => (r.recommendationId ?? '').trim())
        .filter(Boolean);
    }
  }

  const informationalSurfaces: InformationalSurfaceView[] = [];
  if (usesExperienceLayer && exp) {
    for (const s of exp.surfaces) {
      if (s.kind !== 'informational') continue;
      const cat = s.category.trim().toLowerCase();
      const vp = String(s.visualPriority ?? '').trim().toLowerCase();
      const visualWeight: 'quiet' | 'normal' =
        vp === 'quiet' || vp === 'background' || cat === 'analytics' ? 'quiet' : 'normal';
      informationalSurfaces.push({
        surfaceId: s.id ?? null,
        category: s.category,
        insightCategory: s.insightCategory ?? null,
        visualPriority: s.visualPriority ?? null,
        headline: s.headline,
        body: s.body,
        supportingMetric: s.supportingMetric,
        visualWeight,
        confidence: s.confidence ?? null,
        disclosure: disclosureFromSupportingMetric(s.supportingMetric),
      });
    }
  }

  // Phase 5A: opportunityDetection is rendered by dashboard chrome (page.tsx) for now.

  const defaultCv = options.defaultCvProfileId ?? null;
  const byOrch = orchestratedRowByRecommendationId(plan);
  const heroId = effectiveHeroRecommendationId(plan);
  const continuation = buildExecutionContinuationView(plan, exp ?? null);

  let hero: DashboardHeroView | null = null;
  if (usesExperienceLayer && exp) {
    const heroSurface = findHeroSurface(exp);
    const narrative = exp.narrative;
    const dn = plan.dashboardNarrative;

    const rid =
      (heroSurface?.recommendationId?.trim() || heroId?.trim() || '').trim() || null;
    const item = rid ? plan.unifiedPriorities.items.find((x) => x.id === rid) ?? null : null;
    const row =
      (rid ? byOrch.get(rid) : undefined) ??
      exp.visibleRecommendations.find((r) => (r.recommendationId ?? '').trim() === rid) ??
      null;

    const structuredHero = narrative.hero;
    const an = plan.assistantNarrative;
    const pi = plan.personalizationContext?.personalInsights ?? null;
    const primaryInsightActive = plan.personalizationContext?.primaryInsightActive === true;
    const compressedHero = isCompressedHeroValid(an);

    /**
     * Phase 4: When `primaryInsightActive`, backend merges metric-backed copy into assistant + guidance fields.
     * Prefer assistant narrative and structured hero statement before experience-layer heroStory,
     * then flat `personalized*` / personalInsights mirrors, then orchestration fallbacks.
     */
    const title = compressedHero ? (an?.headline?.trim() ?? '')
      : pickFirstNonEmptyTrimmed(
          an?.headline,
          structuredHero?.primaryStatement,
          narrative.heroStory,
          dn?.heroStory,
          heroSurface?.narrativeTitle,
          plan.personalizedHeadline,
          pi?.headline,
          row?.canonicalActionLabel,
          item?.title,
        );

    const subtitle =
      (compressedHero
        ? pickFirstNonEmptyTrimmed(an?.supporting)
        : pickFirstNonEmptyTrimmed(
            an?.supporting,
            plan.dailyNarrativeSummary,
            narrative.heroSubtitle,
            structuredHero?.supportingReason,
            plan.personalizedSupporting,
            pi?.supporting,
            dn?.heroSubtitle,
            heroSurface?.narrativeSubtitle,
            item ? (item.compactDisplay?.primaryLine ?? item.subtitle ?? '') : '',
          )) || null;

    /** Avoid stacking arc/focus chips into the hero secondary line when coaching copy already fills subtitle. */
    const arcLabel =
      compressedHero
        ? null
        : primaryInsightActive && subtitle?.trim()
        ? null
        : plan.experienceState?.narrativeFocusLabel?.trim() ||
          plan.humanizedLabels?.narrativeArc?.trim() ||
          plan.dashboardNarrative?.arcLabel?.trim() ||
          null;

    let href: string | null = null;
    let ctaLabel: string | null = null;
    let minutes: number | null = null;

    if (item && row) {
      href = resolveExecutionDestination({
        cta: item.cta,
        kind: item.kind,
        reasonCodes: item.reasonCodes,
        actionType: item.ctaHint,
        executionContext: item.executionContext,
        executionPayload: item.executionPayload,
        journeyNextRoute: item.journey?.nextRoute ?? null,
        ids: item.ids,
        defaultCvProfileId: defaultCv,
        orchestrationCanonicalRoute: row.canonicalRoute,
        orchestrationFallbackRoute: row.fallbackRoute,
        safeFallback: '/dashboard/job-board',
      }).href;
      ctaLabel =
        row.canonicalActionLabel?.trim() || item.compactDisplay?.actionLabel?.trim() || item.title?.trim() || null;
      const em = item.executionContext?.estimatedMinutes;
      minutes =
        typeof em === 'number' && Number.isFinite(em) ? Math.max(1, Math.round(em)) : null;
    }

    // Phase 6A compressed hero: CTA destination comes from assistantNarrative.ctaHref (validated server-side).
    if (compressedHero) {
      const anHref = an?.ctaHref?.trim() || null;
      const validated = an?.ctaValidated;
      if (anHref && validated !== false) {
        href = anHref;
        minutes = null;
      } else if (plan.assistantGuidance?.href?.trim()) {
        // Back-compat: Phase 5 field.
        href = plan.assistantGuidance.href.trim();
        minutes = null;
      }
    }

    // Prefer backend-provided compressed hero CTA label exactly (no orchestration row fallback).
    if (compressedHero) {
      const compressedLabel = an?.ctaLabel?.trim() ?? '';
      ctaLabel = compressedLabel || null;
    }

    // Route safety: never surface a hero link to a non-dashboard / missing-context route.
    if (href) {
      href = ensureSafeDashboardHref(href, '/dashboard/job-board').href;
    }

    const intensity = heroSurface?.hierarchy?.actionIntensity?.trim().toLowerCase() ?? '';
    const showPrimaryCta = Boolean(href && ctaLabel && intensity !== 'informational');

    if (title.trim()) {
      hero = {
        recommendationId: rid,
        title: title.trim(),
        subtitle: subtitle?.trim() || null,
        href,
        ctaLabel,
        ctaHelper: compressedHero
          ? (an?.microcopy?.trim() ? an.microcopy.trim() : null)
          : pickFirstNonEmptyTrimmed(plan.personalizedNextBestAction, pi?.nextBestAction) ||
            continuationCtaHelperLine(continuation) ||
            null,
        minutes,
        showPrimaryCta,
        arcLabel,
        emotionalTone: an?.tone?.trim() || structuredHero?.emotionalTone?.trim() || null,
        expectedOutcome:
          compressedHero
            ? null
            : pickFirstNonEmptyTrimmed(
                plan.assistantGuidance?.explanation,
                plan.personalizedWhyItMatters,
                pi?.whyItMatters,
                structuredHero?.expectedOutcome,
              ) || null,
      };
    }

  }

  const pipelineSnapshot = exp?.pipelineSnapshot ?? null;
  const pipelineMetrics: PipelineMetricView[] = [];
  if (usesExperienceLayer && pipelineSnapshot) {
    const labelMap: Record<string, string> = {
      interviewing: 'In conversation',
      waiting: 'Awaiting replies',
      followUpNeeded: 'Follow-ups to send',
      newMatchesSinceVisit: 'New since your last visit',
      interviewsUpcoming7d: 'Interviews soon',
      stalledApplied: 'Applications needing a nudge',
      stalledWaiting: 'Waiting longer than expected',
    };
    const preferredOrder = [
      'interviewsUpcoming7d',
      'interviewing',
      'followUpNeeded',
      'waiting',
      'newMatchesSinceVisit',
      'stalledApplied',
      'stalledWaiting',
    ];
    const seen = new Set<string>();
    for (const k of preferredOrder) {
      const v = pipelineSnapshot[k];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        pipelineMetrics.push({ key: k, label: labelMap[k] ?? k, value: v });
        seen.add(k);
      }
    }
    // Add up to 3 additional positive metrics to keep it calm.
    for (const [k, v] of Object.entries(pipelineSnapshot)) {
      if (pipelineMetrics.length >= 6) break;
      if (seen.has(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        pipelineMetrics.push({ key: k, label: labelMap[k] ?? k, value: v });
        seen.add(k);
      }
    }
  }

  const suppressLegacyNextStep = Boolean(
    usesExperienceLayer &&
      (Boolean(exp?.narrative.heroStory?.trim() || plan.dashboardNarrative?.heroStory?.trim()) ||
        Boolean(exp && findHeroSurface(exp))),
  );

  return {
    usesExperienceLayer,
    orchestrationVersion: plan.orchestrationVersion,
    mode,
    momentumLine,
    narrativeTone,
    personalizationContext,
    hero,
    continuation,
    pipelineMetrics,
    informationalSurfaces,
    priorityOrderHint,
    suppressedIds,
    pipelineSnapshot,
    maxPriorityCards: usesExperienceLayer ? 2 : 4,
    suppressLegacyNextStep,
  };
}

/** Drop priorities duplicated as continuation when continuation row matches same recommendation. */
export function shouldSuppressPriorityForContinuationDup(plan: TodayPlanPayload, priorityId: string): boolean {
  const contId = effectiveContinuationRecommendationId(plan);
  if (!contId || contId !== priorityId) return false;
  const exp = plan.dashboardExperience;
  if (!exp) return false;
  const hasContinuationSurface = exp.surfaces.some(
    (s) => s.kind === 'action' && s.category.trim().toLowerCase() === 'continuation',
  );
  return hasContinuationSurface || Boolean(plan.continuationState.suggestedPriorityId?.trim());
}
