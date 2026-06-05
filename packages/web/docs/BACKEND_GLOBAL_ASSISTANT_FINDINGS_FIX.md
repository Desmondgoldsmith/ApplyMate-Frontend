# Global CV assistant — frontend ↔ backend (3.5)

**Status:** Frontend aligned with server-canonical CV + user-facing assistant UX.

## Two assistants (separate UIs)

| Surface | Endpoint | Scope |
|---------|----------|--------|
| Per-section | `POST …/assistant/command` + `targetSection` | **This section** |
| Global | `POST …/assistant/global/command` | **Entire CV** or **Findings only** |

## Recruiter scan → apply fixes

1. **Scan:** `operation: recruiter_scan` → `scope: findings`, no commit.
2. **Apply:** `operation: apply_recruiter_findings` with `findings[]`, `scanCommandId`, `command`.
3. Response: `scope: full_cv`, `sectionDiffs[]`, `patch` → commit via `POST …/assistant/commit`.

Frontend: `CvGlobalAssistantFindingsPanel` → `buildApplyRecruiterFindingsPayload` → `handleApplyRecruiterFindings`.

## Client `cvData` (item 7)

- **Do not send** `cvData` on assistant commands; backend builds from DB (`editorSections` + `sectionInventory`).
- Diff/review UI uses API `sectionDiffs` / `patch` only.
- After commit or accept-all, refetch profile + sections + suggestions (`refreshCvState` / `commitAssistantAcceptedPatch`).

## Clarification copy (item 8)

- Backend sanitizes `clarifyingQuestion`; client also runs `sanitizeAssistantClarificationQuestion` (strips “CV JSON”, etc.).
- Clarification uses `CvAssistantClarificationModal` (not toast-only).

## Unrealistic recommendations (item 9)

- Client filters recruiter findings and suggestion rows that say “add/include Education section” (etc.) when that section already exists (`cvAssistantUserFacing.ts`).
- Dev console logs dropped rows (`profileId`, `section`, `issue`) for backend follow-up.

## Free tier daily AI

- Server default **10/day** (`DAILY_AI_USE_LIMIT`); client fallback when `aiDailyLimit` omitted is **10**.
- CV score refresh does **not** count toward the cap.

## Error codes

- `CV_ASSISTANT_GLOBAL_EMPTY_PATCH`
- `CV_ASSISTANT_GLOBAL_EMPTY_FINDINGS`
- `CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY` (commit 422)

## Hybrid scoring weights

Use `scoringTransparency.weights` from score API. Client fallback 30/70 only when missing.
