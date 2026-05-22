# Backend handoff — Coaching feedback bullets (optional cleanup)

**Frontend fix deployed:** duplicate lines between “Key feedback” and “Key improvements” are deduped client-side. Per–sample-question **Skip** only hides that chip (does not advance the interview).

---

## Issue

`coachingFeedback.improvements` and `coachingFeedback.keyIssues` often contain the **same strings**, so the UI looked like two sections repeating the same advice.

For snapshot/heuristic fallback, `weaknesses` was mapped to both lists.

---

## Desired backend contract

| Field | Semantics | UI |
|--------|-----------|-----|
| `improvements` | 1–4 **actionable** tips (“Add a metric…”, “Use STAR…”) | **Key feedback** |
| `keyIssues` | **Only** gaps not already covered in `improvements` (deeper diagnosis, missing STAR part, etc.) | **Key improvements** (collapsible); omit or `[]` if redundant |

**Rules:**

1. Do not copy the same string into both arrays.
2. If there is nothing extra beyond `improvements`, return `"keyIssues": []`.
3. `suggestedFollowUps` — max 2 **distinct** sample questions; each should be a real follow-up phrasing, not adaptive probe copy (see coaching turn submit handoff).

---

## Example (good)

```json
{
  "improvements": [
    "Name the stakeholder and deadline in the situation.",
    "Quantify the outcome (%, time saved, revenue)."
  ],
  "keyIssues": [
    "Result was implied but never stated in one sentence."
  ]
}
```

## Example (avoid)

```json
{
  "improvements": ["Add more structure to your answer."],
  "keyIssues": ["Add more structure to your answer."]
}
```

---

## QA

- Turn submit with intensive coaching → `keyIssues` empty or strictly additive vs `improvements`.
- `suggestedFollowUps` length ≤ 2; strings differ from each other and from `nextPlannedQuestion.questionText`.

No API shape change required — semantic split only.
