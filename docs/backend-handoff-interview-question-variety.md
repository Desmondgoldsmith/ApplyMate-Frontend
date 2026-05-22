# Interview question variety & session resume

**Status:** Backend shipped (v2 generation). Frontend aligned — no client-side changes required.

---

## Root cause (fixed on backend)

Question sets were cached by **job + CV + role** only (`ip:questions:v1:…`), so every new session for the same job reused the **identical** LLM output.

## Backend behavior (current)

### New session (`POST /api/interviews`, `POST /api/interview-prep/simulate-session`)

1. Pre-assigns `sessionId` (UUID) before generation.
2. **Always generates** a fresh set (cache key includes `sessionId` — no cross-session reuse).
3. Loads stems from the user’s **last 5 sessions** for the same `jobAnalysisId` (or `cvProfileId`) and passes them to Gemini as **do not repeat**.
4. Rotates competency section order deterministically from `varietySeed` (= `sessionId`).
5. Persists questions on `InterviewSession.questionsJson` and syncs `InterviewTurn` rows once.

`setupMetadataJson.questionGeneration` (telemetry):

```json
{
  "questionGenerationVersion": 2,
  "varietySeed": "<sessionId>",
  "excludedStemCount": 12,
  "priorSessionCount": 3,
  "duplicateFromSessionId": null,
  "overlapRatio": null
}
```

If ≥80% of stems match a prior session, backend logs `interview_questions_high_overlap` and sets `duplicateFromSessionId`.

### Resume same session (`GET /api/interviews/:sessionId`, prep enriched GET)

- Reads stored `questionsJson` and turns — **no regeneration**.
- `GET /api/interview-prep/sessions/:sessionId/turns` — stable `questionText` + `questionProgress`.

---

## Frontend contract (unchanged — verified)

| Rule | Implementation |
|------|----------------|
| Display server questions | `session.questions`, `turns[].questionText` via `resolveTurnQuestionText` |
| Progress | `questionProgress.mainQuestionNumber` / `mainTotal` |
| No client shuffle | Turn queue sorted by `order` only; no randomization |
| Per-session cache | `interviewSessionCache` keyed by `sessionId`; React Query `['interview-session', sessionId]` |
| Refresh resume | Pending turn from `session.turns` — intro skipped when answers exist |

**No frontend workarounds** for duplicate questions were added or removed; variety is entirely server-side.

---

## Acceptance alignment

| # | Expectation | Owner |
|---|-------------|--------|
| 1 | New sessions for same job → new stems (exclude prior) | Backend |
| 2 | In-progress GET → same `questions` / turns | Backend + frontend resume |
| 3 | Completed → new session not job-only cache | Backend |

---

## Related docs

- Coaching / evaluation: `docs/backend-handoff-interview-evaluation-and-coaching-ux.md`
- Coaching bullets: `docs/backend-handoff-coaching-feedback-bullets.md`
