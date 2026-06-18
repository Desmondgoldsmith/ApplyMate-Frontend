# Backend handoff — Job Hub guidance polish (auto-complete, CTAs, copy)

**Date:** 2026-06-03  
**Frontend status:** ✅ Integrated (2026-06-10)  
**Backend status:** ✅ Implemented (2026-06-10)  
**Related:** [Job Hub guidance + kanban](./BACKEND_HANDOFF_JOB_HUB_GUIDANCE_KANBAN.md)

---

## Summary

Backend now owns verified task completion, correct CTAs, follow-up copy, and stepper clickability. Frontend consumes enriched payloads on detail GETs and mutation responses; defensive CTA/copy fallbacks remain only when fields are missing or malformed.

---

## Backend implementation (confirmed)

| Area | Status |
|------|--------|
| `pipelineStepper` + `guidance` on detail GETs | ✅ |
| `PATCH /applications/:id/guidance` | ✅ |
| `PATCH /jobs/job-hub/guidance` | ✅ |
| `userToggleable` + `autoCompleted` on tasks | ✅ |
| Stage PATCH returns refreshed stepper + guidance | ✅ |
| Email template generate returns refreshed `guidance` | ✅ |
| Correct CTAs (cover tab, hiring manager, follow-ups) | ✅ |
| Follow-up schedule from `appliedAt` (+7/+14/+21 days) | ✅ |

See backend team notes in the original kanban handoff for payload shapes, phase task lists, and `applicationAssist` transitional field.

---

## Frontend integration (2026-06-10)

| Behavior | Implementation |
|----------|----------------|
| Render stepper + guidance | `JobHubDetailPanel`, parsers in `jobHubGuidance.ts` |
| Manual task PATCH | `usePatchJobHubGuidance` → updates application/job cache |
| Stage change enrichment | `useUpdateApplicationStatus` + `patchJobPipeline` merge cache |
| Email draft → checklist refresh | `generateEmailTemplate` parses `guidance`; panel updates local + cache |
| Verified tasks locked | `isGuidanceTaskUserToggleable()` respects `userToggleable` / `autoCompleted` |
| CTA fallbacks | `resolveGuidanceTaskActions()` only when backend href/tab is wrong or missing |
| Copy fallbacks | `GUIDANCE_TASK_SUPPORTING_FALLBACKS` for 2nd/3rd follow-ups if `supporting` empty |

---

## Acceptance checklist

- [x] Tailor CV → `tailor_cv` auto-completed, not user-toggleable
- [x] Generate cover letter → `draft_cover_letter` auto-completed
- [x] Start interview prep → `practice_interview` auto-completed
- [x] Draft cover letter CTA opens **Cover letter** tab
- [x] Find recruiter CTA opens email tab with **Cold outreach to hiring manager**
- [x] Follow-up tasks include `supporting` copy for 2nd/3rd
- [x] Stage PATCH returns updated `guidance` + `pipelineStepper`
- [x] Stepper steps for past stages remain clickable for corrections

---

## Optional cleanup (frontend)

- Remove `applicationAssist` UI box when guidance panel is always present (already removed from detail chrome).
- Trim defensive CTA remapping once backend CTAs are verified in production for 1–2 releases.
