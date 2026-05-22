# CV Clinic — Phase 3 architecture (frontend)

This document summarizes the Phase 3 refactor focused on **cache scope**, **autosave extraction**, **suggestion queue consistency**, and **panel memoization**. Backend contracts and UI layout are unchanged.

## Component decomposition

- **`useCVAutosave`** (`packages/web/src/hooks/useCVAutosave.ts`): Owns the 800 ms debounced dashboard flush, fingerprint no-op detection, in-flight queueing, and save status transitions. `CVBuilder` still owns `dataRef`, `templateRef`, and `lastPersistedFingerprintRef` so server hydrate and spell/assistant flows share the same refs as before.
- **`refreshCvStateAfterCvParseSuccess`** (`packages/web/src/lib/cvParseCacheReconcile.ts`): Single post-parse reconciliation path used by `useUploadCV` and `CVUploadZone` (including create-then-parse). Avoids unscoped `['cv-sections']`, `['cv', 'score']`, and `['cv', 'suggestions']` invalidations.
- **`ImprovementsPanel`** and **`CvClinicTripleRightPanel`**: Wrapped with `React.memo` to cut avoidable re-renders when parent state changes but props are stable.

Further splits (`useCVBuilderState`, preview section extractors, etc.) can follow the same pattern: move side effects into hooks that receive refs owned by the parent when those refs are shared across features.

## Performance

- Memoized panels reduce subtree work when the dashboard CV page updates unrelated state.
- Autosave logic is unchanged numerically (800 ms debounce, fingerprint short-circuit); extraction is for clarity and unit testing.

## Query invalidation strategy

Canonical per-profile keys (see `refreshCvState`):

- `['cv-profile', profileId]`
- `['cv-sections', profileId]`
- `['cv', 'score', profileId]`
- `['cv', 'suggestions', profileId]` via `cvSuggestionsQueryKey(profileId)`
- `['cv-profiles']` for list metadata

After file parse, **`refreshCvStateAfterCvParseSuccess`** sets `['cv-profile', id]` from the parse envelope, then `await refreshCvState(...)` with `refreshProfile`, `refreshSections`, `refreshSuggestions`, `invalidateScore`, and `invalidateCvProfilesList` as needed—**one** coordinated path instead of broad root invalidations.

Suggestion mutations continue to use **`reconcileAfterCvSuggestionMutation`** for scoped score + suggestions invalidation.

## Cache synchronization (suggestions)

- **`applySuggestionAcceptToImprovementsCache`**: When the client has a non-empty accepted pointer/id, only that id is removed from the pending list. A noisy `acceptedSuggestionIds` array from the server can no longer wipe unrelated rows before refetch; `pendingSuggestionsCount` still comes from the mutation product for server truth.

## Autosave

- Debounce, fingerprint, batch upsert behavior, and `onDashboardSaved` sequencing match the pre-extract implementation; see `useCVAutosave` tests.

## Tests

- **`cvParseCacheReconcile.test.ts`**: Parse success cache writes + scoped refetch/invalidate; missing profile id falls back to list invalidation only.
- **`useCVAutosave.test.tsx`**: Debounce timing to `saveCVBuilderData`.
- **`cvSuggestionsMutationApply.test.ts`**: Regression for overbroad `acceptedSuggestionIds` on single accept.

## Playwright (Phase 3 scenarios)

`packages/web/e2e/cv-clinic-phase3.spec.ts` lists the requested clinic flows. They stay **skipped** unless `PLAYWRIGHT_CV_E2E=1`, matching the existing auth gating pattern. Wire selectors and storage state when CI auth is available.
