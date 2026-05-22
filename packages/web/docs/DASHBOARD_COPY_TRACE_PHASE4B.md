# Dashboard copy trace — Phase 4B (humanization enforcement)

Maps **visible strings → source**. Structured IDs (`recommendationId`, `workflowEntityId`, routes) are **never** concatenated into labels.

## Hero (dashboard overview)

| Region | Component | Prop / source | API field | Fallback |
|--------|-----------|---------------|-----------|----------|
| Title, subtitle, CTA | `HeroRenderer` | `buildDashboardViewModel` → committed experience | `dashboardExperience.narrative` (`heroStory`, `hero`, `heroSubtitle`), `assistantNarrative`, action surface `narrativeTitle` / `narrativeSubtitle`, orchestration row + item (routing only for href) | Missing → legacy `dashboardHeader` / growth (non–experience-layer) |
| Arc / focus line | `HeroRenderer` `composeHeroSecondary` | `stripTechnicalTokens` only on arc | `experienceState.narrativeFocusLabel`, `humanizedLabels.narrativeArc`, `dashboardNarrative.arcLabel` | — |
| Assistant strip | `AssistantHeaderRenderer` | Phase 3 strings | `emotionalSummary`, `dailyNarrativeSummary`, `memorySummary`, `narrativeProgression`, `humanizedLabels`, `assistantReasoning` | No raw `assistantState.narrativeArc` for display |

## Continuation (experience layer)

| Region | Component | API | Notes |
|--------|-----------|-----|--------|
| Title / subtitle | `ContinuationRenderer` → `ExecutionWorkspaceCard` | `dashboardExperience.surfaces[]` continuation action: `narrativeTitle`, `narrativeSubtitle`; execution session: `resumeTarget`, `continuationContext` | Navigation: `actionRoute`, `resumeTarget` — **not** shown as text |
| VM | `dashboardViewModel` `buildExecutionContinuationView` | Same | Title prefers surface copy; CTA label stays short (`taskLabel` / `Continue`) |

## Insights / pipeline (experience layer)

| Region | Component | API |
|--------|-----------|-----|
| Cards | `InsightRenderer`, `PipelineRenderer` | `dashboardExperience.surfaces[]` `headline` / `body`; pipeline metrics from snapshot **numbers** + optional informational surface |
| Legacy panel (no exp layer) | `TodayPlanPanel` informational block | `dashboardViewModel.informationalSurfaces` | Rendered with `safeHumanText` → `stripTechnicalTokens` |

## Today plan panel

| Region | Source | Phase 4B rule |
|--------|--------|----------------|
| Activity counts | Derived `newCount` / `currentCount` | If **both zero**: show `unifiedPriorities.summary.quietDashboardHint` (via `safeHumanText`) or one neutral line — **no** “Fresh today: 0”. |
| Priority CTA | `UnifiedPriorityCard` | `displayActionLabel` uses `safeHumanText` on orchestration / compact labels; ultimate fallback `item.cta.label`. |
| Continuation banner | `continuationState.taskDisplayTitle` / `specificTaskLabel` | Passed through `safeHumanText` before display. |
| Info surfaces | `surf.headline` / `body` | `safeHumanText` then `stripTechnicalTokens`. |

## Client defensive helpers (`assistant-voice/humanize.ts`)

- **`stripTechnicalTokens`** — UUIDs and `kind:id` tails.
- **`safeHumanText`** — strip + **`validateHumanExperienceCopy`** (reject `PIPELINE_*`, `cv_improvement`, colon-id tails, etc.).
- **`maybeWarnInvalidHumanExperienceCopy`** — logs in **development** or when `NEXT_PUBLIC_VALIDATE_HUMAN_COPY=1` (never user-facing).

## When copy is still wrong

1. Inspect **network response** for the field (e.g. `quietDashboardHint`, `narrativeTitle`).
2. If the API is already human-safe but UI shows legacy text → **frontend bug** (wrong branch/prop).
3. If the API returns machine-shaped strings → **backend** `AssistantCopyService` / validation layer.
