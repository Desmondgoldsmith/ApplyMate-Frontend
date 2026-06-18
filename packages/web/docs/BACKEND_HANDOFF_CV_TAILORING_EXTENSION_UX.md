# Backend handoff — CV tailoring UX, ATS metrics & extension cover letter

**Date:** 2026-06-13  
**Frontend status:** Blocked on backend for items **4–8**; will ship **1–3** after backend lands  
**Related:** [Score improvement seniority copy](../../../docs/backend-handoff-score-improvement-seniority-copy.md), [CV section order suggest](./BACKEND_HANDOFF_CV_SECTION_ORDER_SUGGEST.md), [Extension logo & cover letter](./BACKEND_HANDOFF_EXTENSION_LOGO_AND_COVER_LETTER.md)

---

## Summary

| # | Issue | Owner | Backend action needed? |
|---|--------|--------|----------------------|
| 1 | Extension cover letter → **Download PDF** (not Regenerate) | Frontend | No |
| 2 | Extension cover letter **disappears** when leaving job page | Frontend (+ optional API) | Optional — persist + rehydrate |
| 3 | **Section order** banner inconsistent (tailor / clinic / onboarding) | Frontend | No |
| 4 | Tailoring changes — **duplicate / repeated** skills text | Backend + Frontend | **Yes** — payload shape |
| 5 | Tailoring changes — **experience bullets** run together | Backend + Frontend | **Yes** — structured JSON |
| 6 | **New skills appear only after** tailoring starts | Backend | **Yes** — upfront plan |
| 7 | **Keyword match** vs **skills match** show same terms | Backend | **Yes** — separate signals |
| 8 | **Seniority alignment** 50% when levels match; vague copy | Backend | **Yes** — score + detail |

---

## Issue 4 — Tailor draft: repeated skills content in one card

### Symptom (user report)

In **Tailoring changes → Skills section**, the UI shows the same wall of text multiple times:

1. A line like `Reflected selected skills in skills: Content Marketing, …`
2. Full flattened block: `AREAS OF EXPERTISE: Frontend Engineering…Frontend Integration, Content Marketing…`
3. Again under `Updated skills section for job alignment`
4. Again under label `Skills`

### Root cause (likely)

`POST /cv/tailor-draft` (and accept/reject responses) return `CvTailorDraftEntry` where:

- `before` / `after` are **flattened prose strings** (or patch ops coerced to one line), not structured skills JSON.
- `changedFields[]` includes **human summary strings** that duplicate the same content as field paths, e.g. `"Reflected selected skills in skills: …"`.
- Frontend `buildTailorSectionChanges()` then emits **multiple hunks** (changedFields labels + full-section fallback + word diff on the same blob).

### Expected API shape — skills section

For `sectionType: "skills"`, `before` and `after` must be **valid structured JSON** (same schema as CV section storage):

```json
{
  "categories": [
    {
      "name": "Frontend Technologies",
      "skills": ["JavaScript", "TypeScript", "React.js"]
    },
    {
      "name": "Content Skills",
      "skills": ["Content Marketing", "SEO", "CMS"]
    }
  ]
}
```

Or flat list:

```json
{ "skills": ["JavaScript", "React", "SEO"] }
```

### Rules for `changedFields`

| Do | Don't |
|----|--------|
| Machine paths: `categories[1].skills`, `skills` | Full sentences: `"Reflected selected skills in skills: …"` |
| Short labels if needed: `"Content Skills group"` | Duplicate entire `after` body in `changedFields` |
| One entry per real field change | Repeat the same summary under multiple keys |

Optional additive field (recommended):

```typescript
summary?: string;  // single human line, shown once in UI — not repeated in changedFields
```

### Backend acceptance

- [ ] Skills tailor entries use structured JSON in `before` / `after`.
- [ ] `changedFields` are paths only (no prose duplicates).
- [ ] At most one optional `summary` string per entry (if added).
- [ ] No category names concatenated without separators (see Issue 5).

---

## Issue 5 — Tailor draft: experience bullets not structured

### Symptom

Experience suggestions render as one paragraph; bullet markers (`•`) appear **inline** instead of as a list. Multiple roles/bullets are merged into a single string.

Example from UI: `…API integrationVersion Control: Git… • Optimized … • Eliminated …` with no line breaks between roles.

### Root cause (likely)

- `before` / `after` for `sectionType: "experience"` are **plain strings** or flattened HTML, not:

```json
{
  "items": [
    {
      "title": "Frontend Developer",
      "company": "Dummy Group",
      "bullets": [
        "Optimized …",
        "Eliminated …"
      ]
    }
  ]
}
```

- When the model returns patch text, backend may be storing **display strings** instead of merging into structured `items[]`.

### Backend requirements

1. **Always persist experience tailor payloads as structured JSON** with `items[].title`, `company`, `bullets[]`.
2. When generating patches, **merge into the nearest item** (by company/title match), do not append a second role into one bullet string.
3. Preserve newlines or explicit `bullets[]` entries — never rely on `•` inside a single string for UI parsing.
4. For skills (Issue 4), insert separators between category labels when building any fallback plain-text preview (`": "` after labels, newline between categories).

### Backend acceptance

- [ ] Experience `before` / `after` parse as `{ items: [...] }`.
- [ ] Each bullet is its own string in `bullets[]`.
- [ ] Multiple jobs → multiple `items[]` entries, not one concatenated block.

---

## Issue 6 — Skill gaps only appear after tailoring starts

### Symptom

User expects **all job-description gaps** (skills/terms not on the CV) **before** tailoring. Today, additional skills seem to **appear only after** accepting tailor suggestions — as if the AI introduces new requirements mid-flow.

### Expected product behavior

1. **At analyze / open tailor:** show full gap list from job analysis (`missingSkills`, ATS missing keywords, attack plan).
2. **At `createTailorDraft`:** return complete draft plan up front — all section suggestions that will be offered, not discovered incrementally on accept.
3. **`selectedSkills`** on `CvTailorDraft` should list **all** JD skills the tailor will reflect, not grow after each accept.

### Backend requirements

| Endpoint | Change |
|----------|--------|
| `POST /jobs/analyze` | Stable `missingSkills[]` + optional `plannedTailorSections[]` |
| `POST /cv/tailor-draft` | Return **full** `drafts[]` upfront (all pending sections). Do not add new draft entries on accept. |
| Accept section | Update `status` + persist CV only — **no new surprise sections** unless user re-runs tailor |

If the model genuinely finds new gaps while tailoring, attach them to **`analysis.missingSkills`** on the mutation response — do not silently inject new pending draft cards without user opting in.

### Backend acceptance

- [ ] `createTailorDraft` returns all intended section drafts in one response.
- [ ] `selectedSkills` is complete at creation time.
- [ ] Accept/reject does not add unexplained new pending sections.
- [ ] Analysis gap list matches what tailor will address (document any intentional differences).

---

## Issue 7 — Keyword match vs hard skills match are identical

### Symptom

In **CV Score → ATS simulation (job-aware)**, **Keyword match** and **Hard skills match** show the same percentage and the lists below repeat the same terms.

### Intended distinction (product)

| Metric | Meaning | Data source |
|--------|---------|-------------|
| **Keyword match** | Lexical overlap — exact/near-exact terms from JD (tools, certs, phrases) found in CV text | `simulation.keywords.{required,preferred,niceToHave}` |
| **Hard skills match** | Canonical skill ontology — normalized skills (React → JavaScript ecosystem), not every JD keyword | `simulation.hardSkillMatches[]` with `term`, `canonical`, `matched` |

They **may correlate** but must not be copies of the same list/score.

### Backend requirements

1. Compute **keyword coverage** from token/phrase scan of JD vs CV plain text.
2. Compute **hard skill match** from normalized skill entities (CV skills section + inferred from experience), matched against JD skill entities.
3. Populate **`dimensions.keywordMatch`** and **`dimensions.hardSkillMatch`** (or `skillMatch`) with **different** `score0to100` when signals differ.
4. Do not set `hardSkillMatches[].term` to the same strings as `keywords.required.present` unless they are genuinely the same signal.

### Example response fragment

```json
{
  "simulation": {
    "dimensions": {
      "keywordMatch": { "score0to100": 62, "weight": 0.2, "contribution": 12.4 },
      "hardSkillMatch": { "score0to100": 48, "weight": 0.25, "contribution": 12 }
    },
    "keywords": {
      "required": { "present": ["Agile", "Scrum", "CI/CD"], "missing": ["Kubernetes", "Terraform"] }
    },
    "hardSkillMatches": [
      { "term": "React", "canonical": "react", "matched": true },
      { "term": "DevOps", "canonical": "devops", "matched": false }
    ]
  }
}
```

### Backend acceptance

- [ ] Keyword and hard-skill scores can differ.
- [ ] Lists are not duplicated 1:1.
- [ ] Document weights in `dimensions.*.weight`.

---

## Issue 8 — Seniority alignment score & copy

### Symptom

**Seniority alignment** shows **50%** with copy like:

> Role is mid-level; your CV reads as mid-level.

User expectation when **level bands align** but **role family differs**:

> The role is a **mid-level DevOps engineer**; your CV reads as a **mid-level frontend engineer**.

Score should reflect **discipline/title alignment**, not punish matching seniority band alone.

### Problems

1. **Score:** 50% implies mismatch when only generic level matches — likely default or enum-equality bug.
2. **Copy:** Generic level-only text; no **job title vs CV headline** comparison.
3. **Related:** `scoreImprovement.items` still ship enum tokens (`reads as mid`) — see [backend-handoff-score-improvement-seniority-copy.md](../../../docs/backend-handoff-score-improvement-seniority-copy.md).

### Backend requirements

Add to ATS simulation (or job-match breakdown):

```typescript
seniorityAlignment: {
  score0to100: number;           // 0–100
  jobLevel: 'junior' | 'mid' | 'senior' | 'staff' | 'unknown';
  cvLevel: 'junior' | 'mid' | 'senior' | 'staff' | 'unknown';
  jobTitleNormalized: string;    // e.g. "Mid-level DevOps Engineer"
  cvTitleNormalized: string;     // e.g. "Mid-level Frontend Engineer"
  detail: string;                // one sentence, human-readable
}
```

**Scoring guidance:**

| Case | Score direction |
|------|-----------------|
| Same level + same discipline | High (85–100) |
| Same level + different discipline (DevOps vs Frontend) | Moderate (55–75), not 50 by default |
| Level mismatch (mid CV vs senior role) | Lower (20–50) |
| Unknown level | Omit score or return `null` with explanation |

**Copy rules:**

- Never bare tokens: `mid`, `senior` without `-level` or role noun.
- Always mention **role family** when inferable from JD title and CV headline.
- When level matches but discipline differs, **do not** say the user failed seniority — say **title/discipline gap**.

Example `detail`:

> The role is a mid-level DevOps engineer; your CV reads as a mid-level frontend engineer. Same experience band, but recruiters may look for infrastructure and platform evidence.

### Backend acceptance

- [ ] `seniorityAlignmentScore` reflects title/discipline, not level enum equality only.
- [ ] Aligned mid+mid + different disciplines ≠ arbitrary 50% without explanation.
- [ ] Response includes `jobTitleNormalized`, `cvTitleNormalized`, and `detail` (or snake_case equivalents).
- [ ] No `reads as mid` without `-level` in any user-facing string.

---

## Issue 2 (optional) — Extension cover letter persistence

### Symptom

Cover letter generated in the extension **vanishes** when the user navigates away from the job posting (browser tab or sidebar tab). It should persist until **Clear job**.

### Current frontend behavior

- Cover letter stored in `chrome.storage.session` on the job session keyed by `sourceUrl`.
- Lost on session key mismatch (LinkedIn search URL vs `/jobs/view/{id}`), `switchToNewJob`, or hydrate without `session.coverLetter`.

### Optional backend help

| Endpoint | Addition |
|----------|----------|
| `GET /extension/jobs/check` | `hasCoverLetter: boolean` |
| `GET /jobs/generated/:jobAnalysisId` | Return saved cover letter text (already exists for web) |
| `POST /extension/cover-letter` | Already persists — confirm `jobAnalysisId` linkage |

Extension will re-fetch on hydrate when `hasCoverLetter === true`. **Not blocking** if session storage is fixed on frontend.

---

## Issues 1 & 3 — Frontend only (no backend work)

| # | Fix (frontend after backend for 4–8) |
|---|--------------------------------------|
| 1 | Replace **Regenerate** with **Download PDF** using same PDF helper pattern as web (`downloadCoverLetterPdf`) |
| 3 | Unify **CvSectionOrderProactiveBanner** placement: clinic uses in-flow banner; tailor/onboarding use `CvClinicWorkspace` overlay — align layout/styling across `CvClinicPageContent`, `CvClinicWorkspace`, onboarding |

---

## API touchpoints (checklist)

| Endpoint | Issues |
|----------|--------|
| `POST /cv/tailor-draft` | 4, 5, 6 |
| `POST /cv/tailor-draft/:id/accept-section` | 4, 5, 6 |
| `GET /jobs/:id` → `breakdown.ats.simulation` | 7, 8 |
| `GET /cv/profiles/:id/score` (job-aware) | 7, 8 |
| `scoreImprovement` on job analysis | 8 (copy) |
| `GET /extension/jobs/check` | 2 (optional) |

---

## Suggested test cases (backend)

1. **Skills tailor entry** — `before`/`after` parse as JSON; `changedFields` has no prose duplicates.
2. **Experience tailor entry** — two jobs → two `items`; bullets length ≥ 2 with separate strings.
3. **createTailorDraft** — `drafts.length` equals number of sections AI will suggest; stable on accept.
4. **ATS simulation** — keyword score ≠ hard skill score for a fixture JD where lexical ⊃ canonical.
5. **Seniority** — mid DevOps JD + mid Frontend CV → detail mentions both titles; score not hard-coded 50.
6. **Seniority** — mid JD + mid CV same discipline → score ≥ 85.

---

## Frontend follow-up (after backend ships) — ✅ Done (2026-06-14)

1. ✅ Render tailor cards from structured `before`/`after` JSON (`TailorChangeHighlights`, `TailorSectionStructuredView`); `summary` once; path labels from `changedFields`.
2. ✅ Pre-tailor gap checklist from `missingSkills` + `selectedSkills` + `plannedSections` (`PreTailorGapChecklist` in Jobs sidebar + CV clinic tailor panel).
3. ✅ ATS UI: separate keyword vs hard-skill lists; `seniorityAlignment.detail` in `AtsSimulationInsights`.
4. ✅ Extension: **Download PDF** (`cover-letter-pdf.ts`); rehydrate cover letter on `getJobSession` + check when `hasCoverLetter`.
5. ✅ Section order banner: in-flow placement in `CvClinicWorkspace` (onboarding/tailor) aligned with clinic.

Questions → attach **request/response JSON** for `tailor-draft` entry and `breakdown.ats.simulation`.
