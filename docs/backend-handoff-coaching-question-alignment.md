# Coaching aligned to the question answered

**Status:** Backend shipped. Frontend aligned (May 2026).

---

## Backend fixes (summary)

1. Turn submit requires matching `questionText` — scores correct turn or `turnSync` / 400.
2. `nextQuestion` null when mains done; optional via `optionalNextQuestion` only.
3. `answeredQuestion` + `coachingFeedback.questionText` authoritative for UI.
4. `scoredAnswerText` / `transcriptPolished` for reports.
5. `canCompleteInterview` when safe to end.

---

## Frontend wiring

| Contract | Implementation |
|----------|----------------|
| `questionText` on every turn submit | Required in `submitPrepAnswer` (on-screen text) |
| Active turn after submit | `resolveActiveTurnIdAfterSubmit` + `syncQueueFromSession` |
| Coaching panel | `lastFeedback` from **this** response only; `feedbackTurnId` = `answeredQuestion.turnId` |
| Question header | `resolveAnsweredQuestionText` |
| User answer display | `resolveScoredAnswerText` |
| Practice chips | `POST …/practice-coaching` only |
| Optional turn | `optionalNextQuestion` → navigate by `turnId` + matching `questionText` |
| End interview | `canEndInterviewSession(progress, lastFeedback)` |
| Continue | Does not auto-advance optional queue turns (`parentTurnId`) |
| Errors | `QUESTION_TURN_MISMATCH`, `TURN_ALREADY_ANSWERED` user messages |

---

## Related

- `docs/backend-handoff-interview-evaluation-and-coaching-ux.md`
- `docs/backend-handoff-optional-question-progress.md`
