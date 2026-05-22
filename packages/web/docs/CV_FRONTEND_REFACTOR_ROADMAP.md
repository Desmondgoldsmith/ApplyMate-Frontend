# CV frontend refactor roadmap (Phase 7+)

This document captures **future extraction targets** for maintainability. No large refactors are required immediately; prefer incremental moves when touching related code.

## 1. CVBuilder autosave subsystem

**Today:** Debounced flush, queue, and status machine live inside `CVBuilder.tsx` with helpers in `cvBuilder.ts` (`saveCVBuilderData`, batch upsert, perf logging).

**Target:** A dedicated module or hook (e.g. `useCvBuilderAutosave`) owning: dirty detection, debounce timing, in-flight serialization, conflict handling, and callbacks `onSaved` / `onError`. `CVBuilder` would supply refs to current data/sections and consume status for the toolbar only.

**Benefit:** Easier testing, clearer separation from layout/reorder/preview concerns.

## 2. Preview column (triple panel / diff)

**Today:** Diff preview map, assistant preview keys, and chrome are split across dashboard CV page, onboarding clinic, and shared components.

**Target:** A small `CvPreviewColumn` (or headless `useCvDiffPreviewStack`) that owns: preview map state, active key, open/close, and integration points for assistant vs suggestion previews.

**Benefit:** One place to enforce loading, a11y, and “no duplicate clicks” UX for preview actions.

## 3. Spell / grammar subsystem

**Today:** Spell issues flow through `CVBuilder` quality signals and custom events (`cv:spell-issue:*`).

**Target:** Isolate fetch/merge of spell results and “fix all” orchestration behind a hook + optional worker-style module so the builder shell stays layout-focused.

**Benefit:** Reuse in onboarding vs dashboard without duplicating event wiring.

## 4. Suggestion orchestration

**Today:** `useCvSuggestionMutations`, `refreshCvState`, `reconcileAfterCvSuggestionMutation`, and API helpers are composed at page level; bulk accept/reject and diff commit paths share patterns.

**Target:** A thin `useCvSuggestionController(profileId)` that exposes: `acceptAll`, `rejectAll`, `openApplyPreview`, `commitAccept`, `commitReject`, all delegating to existing API modules and the shared hooks.

**Benefit:** Single orchestration layer for dashboard, onboarding, and any future surfaces (e.g. jobs sidebar).

## Final UX checklist (regression QA)

- Accepted AI / structured content **persists after hard refresh**.
- After accept/reject, **one suggestion row** disappears at a time (no whole-list flash unless accept-all).
- No **`[object Object]`** in toasts or inline errors (use `getApiErrorMessage` / `normalizeText` paths).
- **`alreadyApplied`** / terminal no-diff paths auto-resolve with clear copy.
- **Apply with AI** and **Accept** feel responsive: buttons disable while in-flight; spinners stop on error.
- **Empty states** and **counts** (improvements badge, pending count) match server after mutations.
- **429 / RATE_LIMITED**: user sees backoff message, not an infinite spinner; optional **requestId** in dev error lines.

## Backend alignment (Phase 7 envelope)

- Prefer reading **`meta.pendingSuggestionsCount`** / **`meta.cvRevisionId`** from success bodies when wiring global badges (optional; `data` remains canonical for full objects).
- Prefer stable **`/cv/suggestions/:suggestionId/*`** for new code; legacy index routes remain until fully migrated.
