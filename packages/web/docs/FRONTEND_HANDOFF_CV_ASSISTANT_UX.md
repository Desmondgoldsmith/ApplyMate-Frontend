# Frontend handoff — CV assistant & suggestions UX

**Audience:** Frontend team  
**Backend status:** Ready — canonical CV is server-built; omit `cvData` from requests.  
**Implementation status:** Wired in Resume Clinic (`CvClinicPageContent`), onboarding workspace (`CvClinicWorkspace`), suggestions panel, global findings/review panels.

## Related docs

| Doc | Purpose |
|-----|---------|
| `FRONTEND_BRIEF_ASSISTANT_GLOBAL_CV.md` | API shapes, operations catalog, errors |
| `FRONTEND_BRIEF_AI_USAGE_METERING.md` | Daily cap (10/day), accept-all quota |
| `FRONTEND_BRIEF_ASSISTANT_ACCEPT.md` | Commit endpoint envelope |
| `BACKEND_GLOBAL_ASSISTANT_FINDINGS_FIX.md` | Findings apply + client filters |

## Request body (assistant commands)

Omit `cvData` entirely. Server loads CV from profile id + DB sections.

```json
{
  "command": "User instruction here",
  "operation": "rewrite_action_verbs",
  "clarifications": [{ "question": "...", "answer": "..." }]
}
```

## Frontend implementation map

| Checklist | Location |
|-----------|----------|
| A. Loading + no double-submit | `cvAssistantLoadingCopy.ts`, `CvClinicPageContent`, `CvClinicWorkspace`, `ImprovementsPanel`, `AIGlobalAssistantPanel` |
| B. Clarification modal | `CvAssistantClarificationModal.tsx` |
| C. Preview → accept/reject | `commitAcceptDiff`, `CvGlobalAssistantReviewPanel`, diff preview in `CVBuilder` |
| D. Recruiter scan UI | `CvGlobalAssistantFindingsPanel.tsx` + `getRecruiterImprovementFindingsForApply` |
| E. Suggestions apply-all | `ImprovementsPanel.tsx`, `cvAcceptAllQuota.ts` |
| F. Scope labels | `CvAssistantScopeBadge`, operation catalog |
| G. No client cvData | `api.ts` strips `cvData`; review from API `sectionDiffs` |
| Unrealistic tips filter | `cvAssistantUserFacing.ts` (defense in depth) |
| Error toasts with code | `formatApiErrorForToast` in `axios.ts` |

## Daily AI (free tier)

- Default **10/day** (UTC) from `GET /users/me` (`aiDailyLimit`); client fallback **10** when omitted.
- Score refresh does **not** count.
- Accept-all = **one** daily use when `acceptAllAiCalls > 0`.

## QA test plan

1. Recruiter scan → strengths without Fix; actions with Fix.
2. Global/section command with no `cvData` in body → 200.
3. Clarify → modal → preview → commit only on Accept.
4. Apply-all with multiple pending + 1 AI left → one batch, one use consumed.
5. After accept-all → `pendingSuggestionsCount` decreases.
6. Score refresh → daily count unchanged.
