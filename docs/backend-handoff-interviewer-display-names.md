# Interviewer display names — backend contract

**Status:** Backend shipped — frontend aligned (May 2026).

---

## API fields

| Field | Use |
|-------|-----|
| `interviewPersona` | Persona id (`friendly_coach`, `strict_interviewer`, …) |
| `interviewerLabel` | **Human full name** for TTS, intro, and "X asks:" |
| `interviewerRoleLabel` | Role title for UI chips (e.g. Friendly Coach) |
| `personality` | Legacy voice key for `/speech` only (`alex`, `sarah`, `marcus`, `zoe`) |

### Canonical mapping

| `interviewPersona` | `interviewerLabel` | `interviewerRoleLabel` |
|--------------------|--------------------|-------------------------|
| `friendly_coach` | Desmond Goldsmith | Friendly Coach |
| `strict_interviewer` | Isaac Kumi | Strict Interviewer |
| `hr_interviewer` | Amara Osei | HR Interviewer |
| `technical_interviewer` | Priya Sharma | Technical Interviewer |
| `silent_observer` | Jordan Blake | Silent Observer |

---

## Frontend behavior

| Area | Implementation |
|------|----------------|
| Display / TTS name | `resolveInterviewerPersonName` — uses `interviewerLabel` when it is a person name |
| Role subtitle / pills | `sessionPersona.roleLabel` from `interviewerRoleLabel` or local `INTERVIEW_PERSONAS` fallback |
| Legacy sessions | If `interviewerLabel` is still a role title, fallback to canonical `personName` |

Files: `packages/web/src/lib/interviewPersonas.ts`, `InterviewSession` in `api.ts`.

---

## Related

- `docs/backend-handoff-interview-end-session.md`
