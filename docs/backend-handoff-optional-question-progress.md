# Optional question progress (`questionProgress`)

**Status:** Backend shipped. Frontend aligned.

---

## Backend contract (current)

```json
{
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

| Field | Meaning |
|-------|---------|
| `mainTotal` | Main questions only (`session.totalQuestions`, `depth === 0`) |
| `mainPending` | Remaining main questions — **0** → allow finish interview |
| `optionalFollowUpPending` | Optional turns still available (not badge count) |
| `optionalFollowUpAnswered` | **Preferred** for “+N optional answered” badge |

`nextPlannedQuestion` is **null** when no main `pending` turns remain.

---

## Frontend behavior

| UI | Source |
|----|--------|
| `Question N of M` | `mainTotal` + `mainQuestionNumber` / `mainAnswered` |
| `+N optional answered` | `optionalFollowUpAnswered` (fallback: `total − pending`) + client-only `practice-coaching` answers |
| Finish / End interview | `mainPending === 0` |
| Progress bar % | `mainAnswered / mainTotal` |

Practice-only chips (`practiceOnly: true`) use `POST …/practice-coaching` and are tracked client-side until the server counts them.

---

## Related

- Full coaching + eval: `docs/backend-handoff-interview-evaluation-and-coaching-ux.md`
- Question variety: `docs/backend-handoff-interview-question-variety.md`
