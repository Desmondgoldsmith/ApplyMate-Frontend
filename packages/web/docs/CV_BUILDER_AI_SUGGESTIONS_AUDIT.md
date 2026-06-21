# CV Builder — AI Suggestions, Accept Flow & Undo/Redo Audit

**Date:** 2026-06-18  
**Scope:** Frontend-only audit (no code changes). Diagnoses five active bugs before fixes.

| # | Bug |
|---|-----|
| 1 | Accept returns `IMPROVEMENT_STALE_INDEX` |
| 2 | Accept succeeds but editor text not replaced |
| 3 | Accepting one suggestion clears entire suggestions UI |
| 4 | AI suggestions change more than requested (scope creep) |
| 5 | Undo/redo (Ctrl+Z / Ctrl+Y) not working |

---

## Section 1 — CV Builder Architecture

### 1. Top-level component & tree

**Page root:** `packages/web/src/app/(dashboard)/dashboard/cv/page.tsx`

```tsx
export default function CVPage() {
  return (
    <Suspense fallback={<CvClinicPageFallback />}>
      <CvClinicPageContent />
    </Suspense>
  );
}
```

**Component tree (clinic mode, `?profileId=` set):**

```
CVPage (page.tsx)
└── CvClinicPageContent (clinic/CvClinicPageContent.tsx)
    ├── CvClinicToolbar / CvTopChromeMoreMenu (undo/redo, export, etc.)
    ├── CVBuilder (CVBuilder.tsx) — live editor + document preview
    │   ├── [Left] Accordion form editors (Field, BuilderRichTextField, CategorySkillsInput, …)
    │   └── [Right] CVEditProvider → CVDocumentPreview (template: classic/modern/…)
    │       └── InlineField (contentEditable preview edits)
    │       └── sectionBox → CvAiPatchDiffView + CvDiffActionPair (accept/reject during diff)
    └── CvClinicTripleRightPanel (right insights column)
        ├── CVScoreCard / score breakdown
        └── ImprovementsPanel (suggestions list, Apply with AI)
```

**Section editors inside `CVBuilder`:** `AccordionSection` blocks for `personal`, `experience`, `education`, `skills`, `summary`, `projects`, `certifications`, `languages`, `achievements`, `references`, custom sections — each with `Field` / `BuilderRichTextField` / list row editors.

**Preview editors:** `CVDocumentPreview.tsx` renders the printable CV; inline edits go through `InlineField` + `CVEditContext.onUpdate`.

---

### 2. Where CV editor state lives

**Primary live editor state:** React `useState` inside `CVBuilder` — **not Zustand**.

```tsx
// CVBuilder.tsx
const [data, setData] = useState<CVBuilderData>(...);
const [dirty, setDirty] = useState(false);
```

**Shape:** `CVBuilderData` in `packages/web/src/lib/cvBuilder.ts`:

```tsx
export type CVBuilderData = {
  personal: CVBuilderPersonal;
  summary: CVBuilderSummary;
  experience: { items: CVBuilderExperienceItem[] };
  education: { items: CVBuilderEducationItem[] };
  skills: CVBuilderSkills;
  projects: CVBuilderProject[];
  certifications: CVBuilderCertification[];
  languages: CVBuilderLanguage[];
  achievements: CVBuilderAchievement[];
  references: CVBuilderReference[];
  customSections: CVBuilderCustomSection[];
  parsedCustomSections: CVBuilderParsedCustomSection[];
};
```

**Other state layers:**

| Layer | Location | Role |
|-------|----------|------|
| React Query | `queryKeys.cv.profile(id)`, `queryKeys.cv.sections(id)`, `cvSuggestionsQueryKey(id)` | Server profile, sections, suggestions |
| Parent snapshot | `CvClinicPageContent` → `cvDataSnapshot` via `onDataSnapshotChange` | Copy of builder `data` for suggestion filtering |
| Diff preview map | `diffPreviews` + `activeDiffPreviewKey` in `CvClinicPageContent` | Apply-with-AI before/after + `draftHash` |
| Auth | `useAuthStore` (Zustand) | User only — not CV content |
| Undo stack | `useCvUndoRedo` refs inside `CVBuilder` | Past/future snapshots of `CVBuilderData` |

---

### 3. Keystroke → database chain

**Preview inline edit (`InlineField`):**

1. User types in `contentEditable` span → `onInput` sets `editSessionDirtyRef`
2. On blur → `commit()` → `onChange(normalizedHtml)` → parent `ctx.onUpdate` patch
3. `CVBuilder.update(patch)` → `pushUndoSnapshot` (coalesced) → `setData(next)` → `setDirty(true)`
4. `useCVAutosave` effect fires on `[data, dirty, …]` → **800ms debounce** → `flushDashboardAutosave()`
5. `saveCVBuilderData(dataRef.current, sectionsRef.current, { template, cvProfileId })` in `cvBuilder.ts`
6. On success → `onDashboardSaved` in `CvClinicPageContent` (may trigger delayed rescore)

```tsx
// useCVAutosave.ts — debounce
autosaveTimerRef.current = window.setTimeout(() => {
  void flushDashboardAutosave();
}, 800);
```

**Sidebar accordion edit:** `<input>` / `<textarea>` / `BuilderRichTextField` → `update({ ... })` → same autosave chain.

**No direct DB write on keystroke** — only after debounced autosave POST/PATCH to CV profile + section batch endpoints via `saveCVBuilderData`.

---

### 4. Initial CV data on page load

**Hooks in `CvClinicPageContent`:**

```tsx
const { data: detail } = useCVProfileById(targetId);  // GET /cv/profiles/:id
const sectionsQuery = useQuery({
  queryFn: () => api.cv.getSections(true, targetId),  // GET /cv/profiles/:id/sections?includeHidden=true
});
const initialData = useMemo(
  () => transformSectionsToCVBuilderData(profile, sections, { email, name }),
  [profile, sections, user?.email, user?.name],
);
```

**Passed to builder:**

```tsx
<CVBuilder initialData={initialData} existingSections={sections} serverHydrateNonce={cvServerHydrateNonce} />
```

**Hydration inside `CVBuilder`:** when `serverHydrateNonce` bumps, `applyServerHydrateFromInitialData` replaces local `data` from `initialData` ref and **resets undo stack**.

---

### 5. Multiple sources of truth

| Source | Read when | Written when |
|--------|-----------|--------------|
| `CVBuilder` `data` state | All editing & preview | `update()`, server hydrate, undo/redo, `externalPatch`, some `useEffect` merges |
| React Query profile + sections | Build `initialData`, hydrate | Autosave response, accept flows (`syncCvBuilderFromServer`), assistant commit |
| React Query suggestions | `useCVImprovements` → `improvementList` | Apply/accept/reject mutations, cache patches, invalidation refetch |
| `diffPreviews` map | Diff overlay, accept payload (`draftHash`, `changedFields`) | Apply-with-AI, stale retry |
| `cvDataSnapshot` | Suggestion inventory / unrealistic filter | Every `data` change from builder |

**Conflict risk:** Autosave can persist user edits while a diff is open; accept then sends `draftHash` from apply time — stale if CV changed in between (Bug 1).

---

## Section 2 — AI Suggestions: Generation & Display

### 6. How the suggestions panel is populated

**Hook:** `useCVImprovements` → `api.cv.getSuggestions(cvProfileId, false)`

```tsx
// useCVImprovements.ts
queryFn: () => api.cv.getSuggestions(cvProfileId ?? undefined, false),
```

**Endpoint:** `GET /cv/suggestions?cvProfileId=…` (`fetchCvSuggestionsList` in `api.ts`)

**When:** On mount when `targetId` set; refetched after `reconcileAfterMutation` invalidates `cvSuggestionsQueryKey(id)`.

**Display list:** `improvementList` in `CvClinicPageContent`:

```tsx
const improvementList = useMemo(() => {
  const pending = filterPendingSuggestionsForDisplay(improvements.data?.improvements);
  const inventory = buildCvSectionInventory(cvDataSnapshot ?? initialData, sections);
  const { items } = filterUnrealisticCvSuggestions(pending, inventory);
  return items;
}, [...]);
```

Rendered in `ImprovementsPanel` via `CvClinicTripleRightPanel`.

---

### 7. Improvement item shape (API → frontend)

**Type:** `CVImprovementItem` in `api.ts`:

```tsx
export type CVImprovementItem = {
  id?: string;
  status?: 'pending' | 'applying' | 'accepted' | 'rejected' | 'failed' | 'in_progress';
  resolvedAt?: string;
  resolution?: 'accepted' | 'rejected' | 'already_applied';
  section?: string;
  message?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestion?: string;
  example?: string;
  priority?: number;
  issue?: string;
  resolved?: boolean;
  acceptedFieldPaths?: string[];
  pendingFieldPaths?: string[];
};
```

**Envelope:** `CvImprovementsPayload` adds `needsScoring`, `pendingSuggestionsCount`, `score`, `lastPublishedSectionScores`, `cvRevisionId`, `acceptAllQuota`, etc.

Normalizer maps many API aliases (`items`, `improvements`, `suggestions`, `feedback`, …) in `normalizeCVImprovements`.

---

### 8. `draftHash` lifecycle

| Step | Location |
|------|----------|
| **Received** | `POST /cv/improvements/:id/apply` → `CvApplyImprovementResult.draftHash` |
| **Stored** | `cvOpenParamsFromApplyResult` → `diffPreviews[key].draftHash` via `mergeDiffPreviewOpen` |
| **Sent on accept** | `commitAcceptDiff` → `api.cv.acceptImprovement(pointer, profileId, { draftHash: diffPreview.draftHash, acceptedFields })` |
| **Updated after partial accept** | `result.draftHash ?? freshNext.draftHash` written back into `diffPreviews[opKey]` |
| **Updated after stale retry** | Fresh apply response `fresh.draftHash` |

**Not stored globally** — only on the active diff preview entry. If user accepts a different suggestion without re-applying, old hash may still be in that preview object.

---

### 9. "Apply with AI" flow

**Entry:** `ImprovementsPanel.handleApplyWithAI(idx)`

```tsx
const result = await api.cv.applyImprovement(pointer, profileId);
onDiffPreview?.(cvOpenParamsFromApplyResult(result, stableId));
```

**Steps:**

1. `POST /cv/improvements/:id/apply` (`api.cv.applyImprovement`)
2. Parent `mergeDiffPreviewOpen(params)` → `setDiffPreviews`, `setActiveDiffPreviewKey`
3. `CVBuilder` receives `diffSection`, `diffBefore`, `diffAfter`, `diffChangedFields`, `onAcceptDiff`, `onRejectDiff`
4. `CVDocumentPreview.sectionBox` → `resolveCvPreviewSectionDiff` → renders green/red diff + Accept/Reject buttons

**No local CV mutation on apply** — only overlay until accept.

---

### 10. Diff display component

**File:** `CVDocumentPreview.tsx` — function `sectionBox`

```tsx
{sectionChangedFields!.map((cf, i) => (
  <div key={i} className="...">
    <CvAiPatchDiffView
      title={formatDiffTitle(cf.fieldLabel ?? cf.fieldPath ?? '')}
      before={beforeDisplay}  // red strikethrough styling inside CvAiPatchDiffView
      after={afterDisplay}    // green suggested text
      compact
    />
    <CvDiffActionPair
      onAccept={() => onAccept?.(fieldCallbackIndex)}
      onReject={() => onReject?.(fieldCallbackIndex)}
    />
  </div>
))}
```

**Data:** `diffChangedFields` from apply response; `diffSection` mapped via `cvDiffPreviewBuilderSection` (e.g. API `contact` → builder `personal`).

---

## Section 3 — The Accept Flow (Frontend)

### 11. Accept click → API call

**Handler:** `handleAcceptDiff(changeIndex?)` → `commitAcceptDiff(changeIndex?)` in `CvClinicPageContent.tsx`

**Field path selection:**

```tsx
const selectedField =
  changeIndex != null && changeIndex >= 0
    ? (diffPreview.changedFields[changeIndex]?.fieldPath ?? '').trim()
    : '';
const acceptFields = selectedField?.trim()
  ? [selectedField.trim()]
  : diffPreview.selectableFieldPaths?.length
    ? diffPreview.selectableFieldPaths
    : undefined;
```

**API:**

```tsx
await api.cv.acceptImprovement(requestPointer, targetId, {
  ...(acceptFields?.length ? { acceptedFields: acceptFields } : {}),
  ...(diffPreview.draftHash ? { draftHash: diffPreview.draftHash } : {}),
});
```

**HTTP:** `POST /cv/improvements/:ref/accept?cvProfileId=…`  
**Body example:** `{ "acceptedFields": ["experience[0].bullets[1]"], "draftHash": "abc123" }`

**`acceptedFields` is NOT computed from live editor indices at accept time.** It comes from `changedFields[changeIndex].fieldPath` stored when apply preview was opened (or `selectableFieldPaths` fallback).

---

### 12. Field path staleness

**Stored at apply time** in `diffPreview.changedFields[].fieldPath` (backend materialization output).

**Can become stale if:**

- User edits CV after apply (autosave changes structured CV / indices)
- User reorders or deletes experience rows
- Server rescore/revision changes queue

**Mitigation attempted:** `resolveImprovementPointerByField` refetches suggestions and matches `pendingFieldPaths` on stale errors.

**Risk:** Path string `"experience[0].bullets[1]"` is positional — index `0` can shift after edits without updating the preview.

---

### 13. Success response handling

**Non-partial field accept** (`commitAcceptDiff`):

```tsx
// 1. Patch React Query suggestions cache (remove one item)
queryClient.setQueryData(cvSuggestionsQueryKey(targetId), (prev) => { ... filter ... });

// 2. Close diff overlay
closeDiffPreviewForKey(opKey);

// 3. Re-fetch profile + sections, bump hydrate nonce
await syncCvBuilderFromServer();
if (result.sectionsSynced) {
  bumpCvServerHydrateNonce();
}

// 4. Invalidate score + suggestions again
scheduleSectionResyncIfBackgroundTasks(result);
reconcileAfterMutation(targetId, 'structuralAccept');
```

**No direct application of accept response structured payload to `setData`.** Editor update depends entirely on refetch + `serverHydrateNonce` hydrate.

---

### 14. Bug 2 — Accept succeeds, old text remains

**Last frontend steps after success:**

```tsx
await syncCvBuilderFromServer();  // refreshCvState profile+sections, then bumpHydrateNonce
if (result.sectionsSynced) {
  bumpCvServerHydrateNonce();     // second bump
}
```

**`syncCvBuilderFromServer`:**

```tsx
// useCvBuilderHydration.ts
await refreshCvState(profileId, { refreshProfile: true, refreshSections: true });
bumpHydrateNonce();
```

**Hydrate in CVBuilder:**

```tsx
applyServerHydrateFromInitialData → setData(snap from initialData ref); resetUndoStack();
```

**Failure modes:**

1. **`sectionsSynced` false / background sync** — toast says sections refresh later; editor may show pre-accept text until background job + second hydrate
2. **`initialData` useMemo not yet updated** when nonce bumps (React Query cache timing)
3. **Tailor dirty guard** skips hydrate if `isTailorView && dirty`
4. **`mergeNewSectionsIntoData` effect** may merge stale section rows after hydrate
5. **Preview `InlineField` still in edit session** until blur/`dataRevision` (undo fix added `dataRevision`; accept path does not bump it explicitly)
6. Accept response **does not include structured sections applied locally** — only server refetch

---

### 15. Bug 3 — All suggestions disappear

**Suspected frontend causes (code evidence):**

**A. Cache filter removes too many rows** after single field accept:

```tsx
const nextImprovements = prev.improvements.filter((item) => {
  if (result.improvementId && item?.id === result.improvementId) return false;
  if (
    acceptedKey.length > 0 &&
    Array.isArray(item?.pendingFieldPaths) &&
    item.pendingFieldPaths.some((p) => p.trim() === acceptedKey)
  ) return false;  // ← removes ANY suggestion sharing that field path
  return true;
});
```

**B. Optimistic remove when `changeIndex == null` (Accept all on diff):**

```tsx
const wasAcceptAll = changeIndex == null;
if (wasAcceptAll) {
  queryClient.setQueryData(improvementsKey, (prev) => ({
    ...prev,
    improvements: prev.improvements.filter(
      (it) => (it?.id ?? '').trim() !== String(requestPointer).trim(),
    ),
  }));
}
```

**C. `reconcileAfterMutation` always invalidates suggestions:**

```tsx
void queryClient.invalidateQueries({ queryKey: cvSuggestionsQueryKey(id), exact: true });
```

If refetch returns empty (`needsScoring`, rescore in flight, backend null suggestions), UI clears.

**D. Partial accept path invalidates without merging:**

```tsx
void queryClient.invalidateQueries({ queryKey: cvSuggestionsQueryKey(targetId) });
```

**E. No unconditional `setImprovements([])`** in accept handler — empty list comes from refetch or over-aggressive filter, not explicit clear.

---

### 16. React Query invalidation after accept

**From `commitAcceptDiff` success paths:**

| Call | File |
|------|------|
| `reconcileAfterMutation(targetId, 'structuralAccept')` | invalidates `cv.score`, `cvSuggestionsQueryKey`, `cv.profiles` |
| `queryClient.invalidateQueries({ queryKey: cvSuggestionsQueryKey(targetId) })` | partial accept branch |
| `scheduleSectionResyncIfBackgroundTasks` → `refetchCvProfileAndSectionsAfterBackgroundWork` | profile/sections refetch + hydrate nonce |

**Yes — invalidation can refetch empty** if backend returns `suggestions: []` or null during `needsScoring` / `scoreStatus: refreshing` (frontend normalizer keeps array from response; empty array clears UI).

---

## Section 4 — CV Content Update After Accept

### 17. Sequence of state updates

1. `acceptImprovement` API success  
2. Patch suggestions cache (local)  
3. `closeDiffPreviewForKey`  
4. `syncCvBuilderFromServer()` → React Query refetch profile + sections  
5. `bumpCvServerHydrateNonce()` → `CVBuilder` `applyServerHydrateFromInitialData` → **`setData` from refetched `initialData`**  
6. Optional second bump if `sectionsSynced`  
7. Autosave fingerprint reset on hydrate  

**No step applies `result.appliedChangedFields` or structured diff directly to `data`.**

---

### 18. Synchronous vs refetch

**Waits for refetch.** Editor update is asynchronous across React Query fetch + hydrate effect.

---

### 19. Updates to collapsed sections

**Hydrate replaces entire `CVBuilderData`** — accordion expanded state does not gate updates. Collapsed sections still receive new `data` in state and preview.

**Caveat:** Left accordion may show stale values until re-render; preview uses same `data` prop.

---

### 20. Re-fetch endpoint & clobber risk

**Refetch:** `GET /cv/profiles/:id` + `GET /cv/profiles/:id/sections` via `refreshCvState`.

**Hydrate replaces full local `data`** and sets `dirty: false`, **resetting undo stack** — **unsaved edits in other sections are lost** if they were not yet autosaved (800ms window) or if fingerprint matched incorrectly.

---

## Section 5 — Undo/Redo

### 21. Implementation exists

**Hook:** `packages/web/src/hooks/useCvUndoRedo.ts`  
**Wired in:** `CVBuilder.tsx`  
**Exposed to chrome:** `onUndoRedoReady` → `CvClinicPageContent` → `CvClinicToolbar` / `CvTopChromeMoreMenu`

**Keyboard:** `window.addEventListener('keydown', onKey, { capture: true })` in `CVBuilder`:

```tsx
if (e.key === 'z' && !e.shiftKey) { applyHistoryRestore(undoEdit(dataRef.current)); }
else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { applyHistoryRestore(redoEdit(...)); }
```

**Skipped when focus in:** `INPUT`, `TEXTAREA`, `SELECT` — **not** `contentEditable`.

---

### 22. Stack push points

**Primary:** `CVBuilder.update()` — coalesced `pushUndoSnapshot` every 450ms burst:

```tsx
if (!undoCoalesceOpenRef.current) {
  pushUndoSnapshot(current, 'Edit');
  undoCoalesceOpenRef.current = true;
}
```

**Also pushes on:** `externalPatch` (assistant), spellcheck apply, spellcheck apply-all.

**Does NOT push on:** `setData` in section-sync effects, server hydrate, optional section seeding, template photo clear effect.

---

### 23. Not a no-op placeholder

Undo/redo is implemented. Sidebar fields use native browser undo in inputs. Custom stack applies to preview `InlineField` edits and sidebar changes via `update()`.

---

### 24. Input types

| UI region | Element |
|-----------|---------|
| Preview (WYSIWYG) | `InlineField` — **contentEditable** `<span>` |
| Sidebar accordion | `<input>`, `<textarea>`, `BuilderRichTextField` |
| Diff overlay | Read-only diff text + buttons |

**Ctrl+Z in contentEditable:** intercepted by custom handler (capture) unless browser handles first. **Ctrl+Z in sidebar textarea:** handler **returns early** — browser native undo only, **not** connected to custom stack.

---

### 25. Why undo/redo may still fail (Bug 5)

1. **Dual undo systems** — sidebar vs preview not unified  
2. **contentEditable + custom stack** — blur/commit timing; `flushCvInlineEdits` added on undo  
3. **Server hydrate resets stack** after accept/autosave refetch  
4. **`update()` bypass paths** — effects call `setData` without snapshot  
5. **Coalescing** — one undo step per 450ms burst (expected) but user may expect per-field  
6. **Keyboard handler skips TEXTAREA** in left panel — toolbar undo should still work via `undoRedoControlsRef`  
7. **`dataRevision`** added to resync `InlineField` after undo — if not triggered, preview shows old DOM  

---

## Section 6 — Prompt Scope & AI Boundaries

### 26. Fix-with-AI / Apply with AI request

**Improvements apply** sends **no prompt** — only suggestion id:

```tsx
POST /cv/improvements/:id/apply
Body: {}
```

Backend owns materialization scope.

**Section assistant** (`runAssistantCommand`):

```tsx
POST /cv/profiles/:id/assistant/command
{
  command: prepareCvChatTextForAi(command),
  targetSection: ts,
  clarifications?: [...]
}
```

Note: `cvData` in payload type is **stripped** (`_cvDataOmit`) — **frontend does not send full CV** on section command.

**Global assistant:**

```tsx
POST /cv/profiles/:id/assistant/global/command
{ command, operation?, clarifications?, findings?, scanCommandId? }
```

---

### 27. Scoped vs full CV

- **Improvements apply:** Backend loads CV server-side; frontend sends pointer only  
- **Section assistant:** Scoped by `targetSection` string  
- **Global assistant:** Full-CV operations via `operation` key (`add_metrics`, etc.)  

Frontend does not attach full structured CV to improvement apply.

---

### 28. Filtering extra suggestions

**Display queue:** `filterPendingSuggestionsForDisplay` — status `pending` only  

**Unrealistic filter:** `filterUnrealisticCvSuggestions(pending, inventory)` — drops suggestions that reference missing sections/fields  

**Apply preview:** Shows **all** `result.changedFields` from backend — **no client filter** to single requested field  

**Diff accept:** User can accept per-field via `changeIndex`; accepting one field does not prevent other fields in same suggestion from appearing in preview until accepted or rejected  

---

## Section 7 — State Consistency & Race Conditions

### 29. Autosave during diff overlay

**Yes.** Autosave runs whenever `dirty && data` changes — **not blocked** while diff preview is open.

User editing another section triggers save → server CV changes → **`draftHash` on open preview becomes stale** → `IMPROVEMENT_STALE_INDEX` / stale draft errors.

---

### 30. Accept button debounce

```tsx
const cvImprovementDiffInFlightRef = useRef(false);
if (cvImprovementDiffInFlightRef.current) return;
cvImprovementDiffInFlightRef.current = true;
setCvImprovementDiffActionsPending(true);
```

`CvDiffActionPair` uses `CvDiffActionsBusyContext` → buttons `disabled={busy}`.

**Double-click protected** while in flight.

---

### 31. `draftHash` refresh after accept

| Outcome | Hash update |
|---------|-------------|
| Partial accept | `setDiffPreviews` updates `draftHash: result.draftHash ?? freshNext.draftHash` |
| Full accept | Preview closed — hash discarded |
| Stale retry | Fresh apply sets `fresh.draftHash` on preview |
| Success + closed preview | **No global hash** — next accept requires new Apply with AI |

**If user accepts without re-applying after unrelated edits, stale hash risk remains on any still-open preview.**

---

## Bug → Root Cause Summary (Frontend)

| Bug | Primary frontend causes |
|-----|-------------------------|
| **1 STALE_INDEX** | Stale `draftHash` / pointer after autosave or queue revision; retry logic exists but race persists |
| **2 Text not replaced** | No local apply from accept response; hydrate depends on refetch timing + `sectionsSynced` |
| **3 All suggestions gone** | Over-broad cache filter on `pendingFieldPaths`; invalidation refetch during rescore; optimistic `wasAcceptAll` |
| **4 Scope creep** | Apply shows all backend `changedFields`; no frontend scope filter; backend materialization |
| **5 Undo/redo** | Split native vs custom undo; hydrate resets stack; contentEditable vs INPUT handling; setData bypass paths |

---

## Key files index

| Area | Path |
|------|------|
| Page | `packages/web/src/app/(dashboard)/dashboard/cv/page.tsx` |
| Clinic shell | `packages/web/src/components/cv/clinic/CvClinicPageContent.tsx` |
| Builder | `packages/web/src/components/cv/CVBuilder.tsx` |
| Preview / diff UI | `packages/web/src/components/cv/CVDocumentPreview.tsx` |
| Inline edit | `packages/web/src/components/cv/InlineField.tsx` |
| Suggestions panel | `packages/web/src/components/cv/ImprovementsPanel.tsx` |
| Accept API | `packages/web/src/lib/api.ts` (`acceptImprovement`, `applyImprovement`, `getSuggestions`) |
| Cache merge | `packages/web/src/lib/cvSuggestionsMutationApply.ts` |
| Invalidation | `packages/web/src/lib/cvSuggestionMutationReconcile.ts` |
| Autosave | `packages/web/src/hooks/useCVAutosave.ts` |
| Undo | `packages/web/src/hooks/useCvUndoRedo.ts`, `packages/web/src/lib/cvUndoRedo.ts` |
| Hydrate | `packages/web/src/hooks/useCvBuilderHydration.ts` |
