# Interview evaluation, coaching UX, follow-ups

**Status:** Backend shipped (May 2026). Frontend aligned.

---

## Turn answer — `POST /api/interview-prep/sessions/:sessionId/turns/:turnId/answer`

### `processingInsights` (same response)

Frontend: `resolveProcessingInsights()` → `AnswerCoachingLoadingPanel` in the **coaching column only** (not on the question card).

```json
{
  "processingInsights": {
    "headline": "Scoring your STAR structure",
    "steps": ["..."],
    "interviewerContext": "Second-person brief of what this question probes",
    "whileYouWaitTips": ["..."]
  }
}
```

Built from heuristic STAR + `personalization.realTimeSignals.nudges`.

### `suggestedFollowUps` + `nextPlannedQuestion` + `questionProgress`

Up to **3** practice chips at **standard** intensity:

```json
{
  "suggestedFollowUps": [{
    "questionText": "...",
    "practiceOnly": true,
    "parentQuestionText": "<main question answered>",
    "contextLabel": "Optional practice — not counted toward your main question total",
    "answerVia": "POST /api/interview-prep/sessions/:sessionId/practice-coaching"
  }],
  "nextPlannedQuestion": {
    "turnId": "...",
    "questionText": "...",
    "turnKind": "main",
    "mainQuestionNumber": 3,
    "label": "Main question 3",
    "source": "planned"
  },
  "questionProgress": {
    "mainTotal": 5,
    "mainAnswered": 2,
    "mainPending": 3,
    "optionalFollowUpTotal": 2,
    "optionalFollowUpPending": 1,
    "optionalFollowUpAnswered": 1
  }
}
```

Frontend:

- Side chips → `FollowUpSuggestions` (“Side questions (practice)”)
- `nextPlannedQuestion` → `NextPlannedQuestionCard` (hidden when null)
- Turn auto-sync via `turnSync` (no blocking 400 on mismatch)

---

## Pre-answer coaching

**Preferred:** `GET /api/interview-prep/sessions/:sessionId/turns/:turnId/coaching/pre`  
**Fallback:** `GET /api/interview-coaching/pre/:sessionId/:turnId`

`InterviewCoachingLayer` / `PreCoachingPanel` while `phase === 'answering'`.

---

## Practice side questions

`POST /api/interview-prep/sessions/:sessionId/practice-coaching`  
Body: `{ questionText, answerText, parentQuestionText? }`

Continue after practice restores main coaching (does not advance turn queue). End interview clears practice and submits.

---

## Finish interview

- Allow when `questionProgress.mainPending === 0`
- `mainTotal` = main turns only
- Optional badge uses `optionalFollowUpAnswered` (not `optionalFollowUpPending`)

---

## Async evaluation (final submit)

### Submit

`POST /api/interviews/:sessionId/submit` → `{ evaluationStatus: "queued" }`

Frontend: `markInterviewPendingResult`, processing overlay, dashboard banner.

### Poll

`GET /api/interviews/:sessionId/result`

| HTTP | Meaning |
|------|---------|
| 202 | `queued` / `processing` — keep polling |
| 200 | `completed` + `result` |
| 404 | `failed` — show retry, not null result |

### Retry

`POST /api/interviews/:sessionId/retry-evaluation` → poll again.

### Model

`GEMINI_EVAL_MODEL=gemini-2.5-flash` (default in backend).

---

## Quick checklist (verified on frontend)

| # | Check |
|---|--------|
| 1 | Turn submit → loading uses `processingInsights` |
| 2 | `suggestedFollowUps` shown (standard intensity) |
| 3 | `mainPending === 0` → End interview; no TTS loop |
| 4 | Submit → queued → poll until completed |
| 5 | Failed eval → 404 / failed status, retry CTA |
| 6 | Pre-coaching on answering phase |

---

## Frontend files

`page.tsx`, `CoachingPanel.tsx`, `useInterviewPrepFlow.ts`, `interviewPrepNavigation.ts`, `interviewEvaluationPoll.ts`, `InterviewPendingResultBanner.tsx`, `AnswerCoachingLoadingPanel.tsx`.
