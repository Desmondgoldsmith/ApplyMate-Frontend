import { describe, expect, it } from 'vitest';

import {
  normalizeTodayPlan,
  normalizeTodayPlanRoute,
  resolveTodayPlanHref,
  unifiedPriorityDedupeKey,
} from '@/lib/today-plan';

describe('normalizeTodayPlan Phase 1 fields', () => {
  it('parses optional intelligence fields defensively', () => {
    const raw = {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        digestVersion: '1',
        dashboardHeader: {
          momentumMessage: 'You already have momentum today.',
          momentumType: 'progress',
          dashboardMode: 'execution_focus',
          recommendedSections: ['hero', 'today_plan', 'nudges'],
          actionContext: {
            type: 'stalled_application',
            companyName: 'Acme',
            roleTitle: 'Frontend Engineer',
            daysSinceActivity: 6,
            expectedOutcome: 'A short follow-up could restart the thread.',
            suggestedAction: 'Send follow-up',
            estimatedMinutes: 2,
            deepLink: '/dashboard/jobs?jobId=ja1&tab=email',
            canonicalJobId: 'ja1',
            applicationId: 'app1',
            cvProfileId: 'cv1',
            recommendationId: 'rec-hero-1',
            executionMode: 'inline_modal',
            surfaceOwnership: 'hero',
            displayPriority: 1,
            recommendationClusterId: 'cluster-follow-up',
            suppressedBy: null,
            suppressionReason: null,
          },
        },
        unifiedPriorities: {
          items: [
            {
              id: 'p1',
              priorityScore: 80,
              urgencyBucket: 'now',
              kind: 'apply',
              title: 'Apply to Acme',
              confidenceScore: 82,
              confidenceReason: 'Strong fit based on your React experience',
              estimatedOutcome: 'Improves your pipeline odds this week',
              expectedImpactLevel: 'high',
              recommendationFamilyId: 'fam-1',
              suppressionReason: null,
              surfaceOwnership: 'priority_queue',
              displayPriority: 2,
              recommendationClusterId: 'cluster-follow-up',
              workflowState: 'followup',
              workflowEntityKey: 'application:app-xyz',
              suppressedBy: null,
              roleTitle: 'Frontend Engineer',
              roleCompany: 'Acme',
              roleLabel: 'Frontend Engineer at Acme',
              executionContext: {
                nextImmediateAction: 'Send a short follow-up',
                estimatedMinutes: 2,
                emotionalBenefit: 'You will feel back in control',
                executionMode: 'inline_modal',
                deepLink: '/dashboard/jobs?jobId=ja1&tab=email',
                canExecuteInline: true,
                preparedDraft: 'Hi team, quick follow-up on my application.',
                suggestedTone: 'professional',
                estimatedSuccessLikelihood: 0.62,
                preparationChecklist: ['Review role notes'],
                suggestedTalkingPoints: ['Recent project result'],
                quickActions: ['Copy message'],
                fallbackAction: 'Open email client',
                canonicalJobId: 'ja1',
                applicationId: 'app1',
                cvProfileId: 'cv1',
                recommendationId: 'rec-1',
                executionType: 'followup',
              },
              followUpContext: {
                suggested: true,
                daysSinceLastActivity: 6,
                confidence: 0.8,
                recommendedChannel: 'email',
                draftMessage: 'Hi team, following up on my application.',
                suggestedTone: 'professional',
                recoveryLikelihood: 0.52,
                recommendedSendWindow: 'Today before noon',
                rationaleShort: 'Hiring teams often respond after a nudge.',
              },
              interviewPrepContext: {
                jobAnalysisId: 'ja1',
                jobTitle: 'Frontend Engineer',
                company: 'Acme',
                cvProfileId: 'cv1',
                preferredCvProfileId: 'cv-pref',
                analyzedCvProfileId: 'cv-ana',
                tailoringCvProfileId: 'cv-tailor',
                likelyTopics: ['React architecture'],
                likelyQuestions: ['How do you debug perf issues?'],
                preparationChecklist: ['Review project stories'],
                missingSignals: ['Leadership story'],
                suggestedStories: ['Shipped design system migration'],
                estimatedPrepMinutes: 20,
                hydrationReady: true,
                selectedCvProfileId: 'cv-resolved',
              },
              cvFixContext: {
                affectedSection: 'Experience',
                suggestedPatch: 'Add measurable outcomes',
                expectedImpact: 'Clearer impact for recruiter scan',
                confidenceReason: 'Current bullets are generic',
              },
              qualitySignals: {
                urgency: 'medium',
                reversibility: 'easy',
                momentumImpact: 'high',
                estimatedUserEffort: 'low',
                confidenceTier: 'high',
              },
              reasonShort: 'This thread has gone quiet.',
              reasonDetailed: 'A short follow-up now can restart the conversation.',
              recommendationId: 'p1',
              generationReason: 'stalled_follow_up',
              priorityState: 'ready_now',
              actionReassurance: 'This should only take a few minutes.',
              cta: { label: 'Open', action: { type: 'OPEN_JOB_HUB' } },
              applyAssist: {
                frictionScore: 22,
                completionLikelihood: 88,
                blockers: [],
                readyState: 'ready',
                estimatedSteps: 2,
                estimatedStepsRemaining: 2,
                fastPathEligible: true,
              },
              ids: { jobAnalysisId: 'ja1' },
            },
          ],
          summary: {
            workflowOrchestration: [
              {
                entityType: 'application',
                entityId: 'app-xyz',
                recommendationClusterId: 'cluster-follow-up',
                primaryWorkflowState: 'followup',
                owningRecommendationId: 'own-rec-1',
                primarySurfaceOwner: 'priority_queue',
              },
            ],
            suppressionFamilyCount: 1,
            dedupeDroppedCount: 0,
            highPriorityCount: 1,
            followUpDueCount: 0,
            newOpportunitiesCount: 0,
            currentRecommendationsCount: 1,
            newRecommendationsCount: 0,
            carryOverRecommendationsCount: 0,
            localRecommendationsCount: 0,
            remoteFallbackRecommendationsCount: 0,
          },
        },
        sinceLastVisit: {},
        progress: {},
        dailyMission: {
          isMeaningful: false,
          recommendedPriorityIds: [],
          targetActionsToday: 0,
          actionsRemainingToday: 0,
        },
        continuationState: {
          remainingSteps: 2,
          interruptionAgeHours: 30,
          resumeConfidence: 80,
          resolvedRoute: '/dashboard/jobs?jobId=ja1',
          routeValidated: true,
          routeValidationReason: 'ok',
          lastMeaningfulAction: {
            priorityId: 'p1',
            kind: 'apply',
            title: 'Finish tailoring',
            ctaHint: 'Open hub',
          },
        },
        reentrySummary: {},
      },
    };

    const plan = normalizeTodayPlan(raw);
    expect(plan.dashboardHeader?.momentumMessage).toContain('momentum');
    expect(plan.dashboardHeader?.momentumType).toBe('progress');
    expect(plan.dashboardHeader?.dashboardMode).toBe('execution_focus');
    expect(plan.dashboardHeader?.recommendedSections).toContain('today_plan');
    expect(plan.dashboardHeader?.actionContext?.suggestedAction).toBe('Send follow-up');
    expect(plan.dashboardHeader?.actionContext?.applicationId).toBe('app1');
    expect(plan.dashboardHeader?.actionContext?.surfaceOwnership).toBe('hero');
    const item = plan.unifiedPriorities.items[0];
    expect(item?.confidenceScore).toBe(82);
    expect(item?.estimatedOutcome).toContain('pipeline');
    expect(item?.recommendationFamilyId).toBe('fam-1');
    expect(item?.surfaceOwnership).toBe('priority_queue');
    expect(item?.displayPriority).toBe(2);
    expect(item?.recommendationClusterId).toBe('cluster-follow-up');
    expect(item?.applyAssist?.frictionScore).toBe(22);
    expect(item?.applyAssist?.readyState).toBe('ready');
    expect(item?.priorityState).toBe('ready_now');
    expect(item?.actionReassurance).toContain('minutes');
    expect(item?.roleLabel).toContain('Acme');
    expect(item?.executionContext?.executionMode).toBe('inline_modal');
    expect(item?.executionContext?.preparedDraft).toContain('follow-up');
    expect(item?.executionContext?.canonicalJobId).toBe('ja1');
    expect(item?.followUpContext?.recommendedChannel).toBe('email');
    expect(item?.followUpContext?.recommendedSendWindow).toContain('noon');
    expect(item?.interviewPrepContext?.likelyTopics[0]).toContain('React');
    expect(item?.interviewPrepContext?.preferredCvProfileId).toBe('cv-pref');
    expect(item?.interviewPrepContext?.hydrationReady).toBe(true);
    expect(item?.interviewPrepContext?.selectedCvProfileId).toBe('cv-resolved');
    expect(item?.workflowState).toBe('followup');
    expect(item?.workflowEntityKey).toBe('application:app-xyz');
    expect(item?.cvFixContext?.affectedSection).toBe('Experience');
    expect(item?.qualitySignals?.estimatedUserEffort).toBe('low');
    expect(item?.reasonShort).toContain('quiet');
    expect(plan.unifiedPriorities.summary.suppressionFamilyCount).toBe(1);
    expect(plan.unifiedPriorities.summary.workflowOrchestration[0]?.entityId).toBe('app-xyz');
    expect(plan.unifiedPriorities.summary.workflowOrchestration[0]?.primaryWorkflowState).toBe('followup');
    expect(unifiedPriorityDedupeKey(plan.unifiedPriorities.items[0]!)).toBe(
      'workflow_entity::application:app-xyz',
    );
    expect(plan.continuationState.remainingSteps).toBe(2);
    expect(plan.continuationState.lastMeaningfulAction?.priorityId).toBe('p1');
    expect(plan.continuationState.resumeConfidence).toBe(80);
    expect(plan.continuationState.routeValidated).toBe(true);
    expect(plan.continuationState.routeValidationReason).toBe('ok');
  });

  it('resolves interview prep deep-link from action payload', () => {
    const href = resolveTodayPlanHref({
      label: 'Prep for interview',
      action: {
        type: 'OPEN_INTERVIEW_PREP',
        interviewPrepJobAnalysisId: 'ja42',
        interviewPrepJobTitle: 'Frontend Engineer',
        interviewPrepCompany: 'Cosmoquick',
        interviewPrepCvProfileId: 'cv99',
        preferredCvProfileId: 'cv88',
        analyzedCvProfileId: 'cv77',
        tailoringCvProfileId: 'cv66',
      },
    });
    expect(href).toContain('/dashboard/interview?');
    expect(href).toContain('jobAnalysisId=ja42');
    expect(href).toContain('cvProfileId=cv99');
    expect(href).toContain('preferredCvProfileId=cv88');
  });

  it('normalizes deprecated cv clinic deep-links', () => {
    expect(normalizeTodayPlanRoute('/dashboard/cv-clinic')).toBe('/dashboard/cv');
    expect(normalizeTodayPlanRoute('/dashboard/cv-clinic?profileId=cv1')).toBe('/dashboard/cv?profileId=cv1');
  });
});
