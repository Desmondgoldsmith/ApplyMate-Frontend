# Backend handoff — Tailor diff display UX (experience labels & summary HTML)

**Date:** 2026-06-14  
**Frontend status:** ✅ Addressed in UI (path chips removed; HTML + role labels rendered)  
**Related:** [CV tailoring & ATS](./BACKEND_HANDOFF_CV_TAILORING_ATS_SENIORITY.md)

---

## Context

Users reviewing tailor suggestions were confused by:

1. Machine path chips (`categories 0 › skills 4`, `items 2 › bullets 1`) shown in the UI  
2. Raw HTML (`<strong>…</strong>`) in summary suggestions  
3. Experience cards that did not clearly identify **which role** was being edited  

Frontend now:

- **Hides** `changedFields` paths from the UI (still used internally to resolve role names)  
- **Renders** summary/experience bullet HTML via the same rich-text pipeline as CV preview  
- **Shows** human labels like `Frontend Developer at Dummy Group (Jul 2024 – Dec 2025)` derived from diff JSON + path indices  

---

## Backend recommendations (optional hardening)

### Experience diff payloads

Each entry in `before` / `after` for `sectionType: "experience"` should include:

| Field | Required for UX | Notes |
|-------|-----------------|-------|
| `title` | ✅ | Job title |
| `company` | ✅ | Employer — critical when user has multiple roles with the same title |
| `startDate` / `endDate` | Recommended | Disambiguates duplicate title+company rows |
| `bullets[]` | ✅ | Changed bullets only (diff-only display) |

**Anti-pattern:** Two diff items both `{ title: "Frontend Developer", company: "Ahegel" }` when they refer to different CV rows — frontend cannot distinguish them without dates or distinct company names.

**Preferred:** Copy canonical `title`, `company`, and date range from the full CV section when building diff-only items (index in `changedFields` is for patch apply only, not for user display).

### Skills diff payloads

No UI change needed — frontend shows **Added** / **Removed** skill pills only.  
Keep `changedFields` as machine paths; do **not** send prose duplicates in `changedFields`.

### Summary diff payloads

| Shape | Notes |
|-------|-------|
| `{ "text": "<p>…</p>" }` or `{ "summary": "…" }` | HTML/markdown-lite is fine — frontend renders via `toPreviewRichTextHtml` |
| Plain string JSON | Also supported |

Ensure `<strong>`, `<em>`, `<a href="…">` tags are well-formed (no unescaped partial tags mid-word).

### `summary` field (top-level on draft entry)

Keep as a single human sentence, e.g.  
`"Refined bullets for 2 role(s)"` — frontend maps `items[n]` paths to role labels automatically when title/company are present.

---

## Verification

1. Tailor experience with two different companies → sidebar shows two distinct **Roles updated** lines.  
2. Tailor summary with `<strong>TypeScript</strong>` → bold in UI, not literal tags.  
3. Skills tailor card → no gray path chips; only Added skills list.  

---

## Questions

If role labels still look wrong after re-tailor, attach one `drafts[]` experience entry (`before`, `after`, `changedFields`) — likely missing or incorrect `company` / dates on diff items.
