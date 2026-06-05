# CV section order suggest API

**Original handoff date:** 2026-06-03  
**Backend fixed:** 2026-06-04  
**Status:** ✅ Resolved — API and frontend aligned

---

## Backend response (2026-06-04)

`POST /api/cv/profiles/:profileId/sections/suggest-order` now uses the **same canonical type rank table** as web `PROFESSIONAL_SECTION_TYPE_ORDER` for:

- `isOptimal`
- `suggestedOrder` (visible rows stable-sorted by rank, then `order`, then `id`)
- `showProactiveSuggestion` (= `!isOptimal` for MVP)

Career stage + industry are still returned and personalize `changes[].explanation` and `overview`.

**Backend code:** `src/modules/cv/scoring/section-order-suggest.ts`  
**Backend tests:** `npm test -- --testPathPattern=section-order-suggest`

### Example (core sections wrong order)

**Stored visible order:** education → summary → experience → skills

**API now returns:**

- `isOptimal: false`
- `showProactiveSuggestion: true`
- `suggestedOrder`: summary → experience → education → skills (+ hidden ids at tail)
- `changes`: one entry per moved section with label + explanation

---

## Frontend integration

The frontend calls the same endpoint via `api.cv.suggestSectionOrder(profileId)` (`POST /cv/profiles/:id/sections/suggest-order`).

**Primary path:** API response drives the proactive banner and reorder modal (including career-stage/industry copy from `changes[]` and `overview`).

**Safety net (kept):** If the API ever returns `isOptimal: true` while live section rows are still misordered, `mergeSectionOrderSuggestWithClientFallback()` in `cvSectionOrderSuggest.ts` substitutes a generic client-built suggestion so users are not blocked. This should not trigger under normal operation after the backend fix.

**Instant banner:** `sectionsOrderIsSuboptimal()` on cached section rows can show the banner before the suggest query resolves; once the API responds, API data takes precedence when it reports non-optimal order.

---

## Canonical type order (shared contract)

| Rank | Type |
|------|------|
| 0 | `personal` |
| 1 | `links` |
| 2 | `summary` |
| 3 | `experience` |
| 4 | `education` |
| 5 | `skills` |
| 6 | `projects` |
| 7 | `certifications` |
| 8 | `languages` |
| 9 | `achievements` |
| 10 | `references` |
| 11 | `volunteering` |
| 12 | `interests` |
| 13 | `publications` |
| 950 | `custom` / `custom_*` |
| 900 | unknown types |

Frontend source: `packages/web/src/lib/cvSectionProfessionalOrder.ts`

---

## Related items (also resolved)

### Custom section without title

- `POST /cv/profiles/:id/sections` with `{ "type": "custom" }` succeeds.
- Default slug: `custom_section_0` (or next free index); default `data.title`: **"Custom section"**.
- Frontend allows add without name; renames persist via `parsedCustomSections[].title` → batch-upsert / PATCH.

### Language proficiency

- No backend coercion of empty proficiency — aligned with frontend (placeholder only, no default on new rows).

---

## Frontend files

- `packages/web/src/lib/cvSectionOrderSuggest.ts`
- `packages/web/src/hooks/useCvSectionOrderFlow.ts`
- `packages/web/src/components/cv/CvSectionOrderSuggestModal.tsx`
- `packages/web/src/lib/cvSectionProfessionalOrder.ts`

---

## Original issue (for history)

Before 2026-06-04, core-only CVs with misordered sections (e.g. education before summary) often received `isOptimal: true`, so the reorder UI incorrectly said everything was already in order. The client fallback was added as a temporary mitigation; the API fix makes that path the exception rather than the rule.
