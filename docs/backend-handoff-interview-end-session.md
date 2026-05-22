# End interview session — backend contract (canonical)

**Status:** Backend answered — frontend aligned (May 2026).

---

## Summary

| Topic | Backend behavior |
|--------|------------------|
| Finish endpoint | `POST /api/interviews/:sessionId/submit` after turn answers (no separate prep `/complete`) |
| Submit payload | **Main questions only** — one entry per `depth === 0` turn / non–`follow_up` question |
| Session status after submit | Stays `in_progress` until evaluation completes → then `completed` |
| Resume after end | Do not resume questioning while `finishingInterviewRef` is set; optional turns may show `skipped` after submit |

---

## Frontend alignment

| Contract | Implementation |
|----------|----------------|
| Main-only submit payload | `buildSubmitAnswersFromTurns` filters `isMainInterviewTurn`, excludes `section === 'follow_up'` |
| Finish flow | `finishPrepAndSubmit` → `phase=submitting` → `POST /submit` with `idempotencyKey: finish-{sessionId}` → `phase=processing` → poll result |
| Submit failure | Stay on `answer_feedback` with error; **do not** set `phase=answering` |
| Resume guards | Skip resume when pending local submit, `finishingInterviewRef`, or scoring pending; resume only **main** `pending` turns |
| Refresh during finish | Stored pending submission restores `submitting` + `finishingInterviewRef` |
| Post-interview thanks | TTS `postInterviewThankYou` on `submitting`/`processing`; on-screen copy on submit overlay (no TTS stop race) |
| Dashboard Continue | `listContinuationItemsForDisplay` — `evaluation_processing` / `results_ready` CTAs; hide `evaluationStatus: completed` |
| Leave while scoring | `leaveWhileScoring` → dashboard; `InterviewPendingResultBanner` + continuation card |

---

## A. Finalization endpoint

| # | Answer |
|---|--------|
| 1 | **Yes.** `POST /api/interviews/:sessionId/submit` after `POST /api/interview-prep/sessions/:sessionId/turns/:turnId/answer`. |
| 2 | **No** prep-only complete endpoint. |
| 3 | **Order:** turn answers → `/submit` when `canCompleteInterview` or `mainPending === 0` → poll `GET …/result`. |

---

## B. Submit payload

| # | Answer |
|---|--------|
| 4 | Turn `status`: `pending` \| `answered` \| `skipped` \| `evaluated`. After turn submit → `answered`. |
| 5 | Build from main turns: `depth === 0`, `answered` \| `evaluated`, non-empty `answerText`. Exclude `depth > 0` and practice-only. |
| 6 | `questionId` = `session.questions[].id`. Exclude `section === 'follow_up'`. |
| 7 | Count must equal **main question count** or `400 Expected N main question answer(s); received M`. |

---

## C. Session status & UI transitions

| # | Answer |
|---|--------|
| 8 | `in_progress` after `/submit` until eval → `completed` or `evaluation_failed`. |
| 9 | Optional pending turns → `skipped` on submit; client enters **processing**, does not resume first pending main. |
| 10 | Optional follow-ups do **not** block finish. |

---

## D. Flags (confirmed)

| Field | Confirmed |
|-------|-----------|
| `canCompleteInterview` | Safe to show **End interview** without optional follow-ups. |
| `mainPending === 0` | Finish allowed. |
| `nextPlannedQuestion` | `null` when no more mains. |
| `optionalNextQuestion` | Does not block end. |

---

## E. Error cases

| # | Answer |
|---|--------|
| 11 | Common failures: count mismatch, unknown `questionId`, incomplete answers, `410`, already completed. |
| 12 | On failure: stay on feedback/submitting with retry — **not** `answering`. |
| 13 | `/submit` returns `200` + `evaluationStatus: queued`; poll `GET …/result`. |

---

## Related handoffs

- `docs/backend-handoff-coaching-question-alignment.md`
- `docs/backend-handoff-optional-question-progress.md`
- `docs/backend-handoff-interview-evaluation-and-coaching-ux.md`
