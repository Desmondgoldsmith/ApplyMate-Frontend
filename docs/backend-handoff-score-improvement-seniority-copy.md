# Backend handoff — Score improvement seniority copy

## Problem

Post-tailor `scoreImprovement.items` sometimes ship enum-style tokens in user-facing `detail` strings, e.g.:

> This role is framed as mid level; your CV reads as mid. Closing a large gap usually means more responsibility in your work history or targeting a closer level.

Users read **"mid"** twice and assume we mean their CV literally says the word "mid" — we mean **seniority band** (junior / mid-level / senior / staff / principal).

## What we actually mean

| Phrase (intended) | Meaning |
|-------------------|---------|
| Role is **mid-level** | The job posting targets mid-level seniority (title, years, scope in the JD). |
| CV **reads as mid-level** | Our model infers mid-level from experience depth, titles, and scope on the CV — not a literal keyword. |
| Both mid-level, still a gap | Level is aligned; the score cap is from **years, scope, must-haves, or industry depth** — not title wording. |

## Rules for `build-score-improvement-guide.ts` (and attack plan if reused)

1. **Never emit bare enum tokens** in `title` or `detail`: `mid`, `senior`, `junior`, `staff`, `principal`, `executive`.
2. **Always use human labels**: `mid-level`, `senior-level`, `junior-level`, etc.
3. **Prefer plain language**:
   - ✅ `The job targets mid-level experience; your CV reads as mid-level overall.`
   - ❌ `framed as mid level; your CV reads as mid`
4. **When job level ≈ CV level**, do not imply a seniority mismatch. Say alignment and point to experience depth / scope / must-haves instead.
5. **`axis: role_level`** items should explain **real-world fit** (years, scope, title progression), not CV tailoring.

## Example rewrites

**Before (bad):**
```json
{
  "id": "role-mid-senior",
  "title": "Seniority / role level",
  "detail": "This role is framed as mid level; your CV reads as mid. Closing a large gap usually means more responsibility in your work history or targeting a closer level.",
  "axis": "role_level",
  "actionableInTailor": false
}
```

**After (good — aligned level):**
```json
{
  "id": "role-level-scope",
  "title": "Scope and depth vs the JD",
  "detail": "You and this role are both mid-level on paper. Reaching a much higher match usually needs more years in the role, broader ownership, or a closer industry fit—not more CV wording.",
  "axis": "role_level",
  "actionableInTailor": false
}
```

**After (good — under-level for role):**
```json
{
  "id": "role-level-gap",
  "title": "Seniority vs the role",
  "detail": "The job is pitched at senior level; your CV reads as mid-level today. That gap is about progression in your work history, not keywords in your summary.",
  "axis": "role_level",
  "actionableInTailor": false
}
```

## Frontend mitigation (temporary)

`humanizeScoreImprovementDetail()` rewrites common patterns until API copy is fixed. Prefer fixing at source in this guide builder.

## QA

- [ ] No `detail` string contains standalone ` mid ` or ` reads as mid ` without `-level`.
- [ ] When inferred job level equals CV level, copy does not claim a seniority mismatch.
- [ ] `role_level` items never suggest tailoring; advice-only post-tailor card.
