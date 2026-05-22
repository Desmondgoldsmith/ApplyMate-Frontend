# Backend handoff — Dashboard “pipeline nudges” card (in-app weekly stall summary)

## Goal

Expose the **same conceptual content** as the **weekly stall digest email** inside the web app on the **home Dashboard**, so users see “jobs that may need attention this week” **without relying on email alone**.

This should **not** be a second, divergent scoring engine: **one source of truth** for “what’s stalled / worth revisiting,” reused by **email + in-app** (or derived from the same query/rules).

---

## Product intent

1. **Parity with email** — The email says “here’s what looks stuck”; the dashboard card shows **the same list or a capped subset** (e.g. top 3–5 + “view all”) so users never see conflicting stories between channels.

2. **Respect existing prefs** — Apply the **same gates** as the weekly digest path:
   - **`weeklyStallDigest !== false`** (opt-out; missing key = on, aligned with current contract).
   - **`nudgePausedUntil`** if it suppresses marketing-style digests (same as email scheduler).
   - **`maxMarketingEmailsPerWeek`** applies to **email volume**, not necessarily to in-app rows—but if product wants to **hide** the card when digest is fully suppressed, document that rule explicitly (see Open questions).

3. **Lightweight v1** — Ship a **compact card**: title, short explainer, N items (role/company/stage or similar), primary CTA **View all** → existing **`/dashboard/next-moves`** or **Job Hub** deep link. Full reporting can wait.

4. **Legal / marketing** — If the weekly digest is treated as **marketing** in some regions, confirm whether an **in-app summary** needs the same consent rules as the email. Frontend can gate rendering on an explicit flag from API if required.

---

## Suggested API options (pick one; prefer minimal surface)

### Option A — Dedicated read endpoint (recommended for clarity)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/dashboard/weekly-stall-summary` | Returns stalled pipeline rows + metadata for the **current user**, **same rules** as digest email body. |

**Illustrative response (adjust to your DTOs):**

```json
{
  "generatedAt": "ISO-8601",
  "digestVersion": "optional string for cache/debug",
  "eligible": true,
  "reasonIfEmpty": "opt_out | paused | no_stalled_rows | …",
  "items": [
    {
      "id": "stable row id for analytics",
      "title": "Role title",
      "company": "Company",
      "kind": "application | analysis | bookmark",
      "applicationId": "uuid | null",
      "jobAnalysisId": "uuid | null",
      "bookmarkId": "uuid | null",
      "stallReasonCodes": ["string"],
      "ctaHint": "optional enum for client routing"
    }
  ],
  "totalCount": 12,
  "showMoreHref": "/dashboard/next-moves"
}
```

- **`eligible: false`** when user opted out of digest or pause applies (match email behavior); card hides or shows “digest off” copy per product.
- **`items`** may be **capped** (e.g. 5) with **`totalCount`** for “+9 more” copy.

### Option B — Extend existing aggregate

If you already ship **`GET /api/dashboard/next-moves`** (or plan to), add a **`stallSummary`** section **or** ensure that endpoint returns enough for a thin dashboard card without a second round-trip. **Avoid** two different stall-detection implementations.

---

## Server-side rules (must match email)

- **Stall detection** — Same thresholds / entity types as the weekly digest email (applications, orphan analyses, orphan bookmarks — whatever the email uses today).
- **Freshness** — Invalidate or short TTL when pipeline data changes (stage moves, bookmarks, analyses), consistent with Today’s Plan / digest invalidation story.
- **Auth** — Bearer JWT; only the authenticated user’s rows.

---

## Frontend usage (for your planning)

- **Dashboard** (`/dashboard`) will call this endpoint when the user is logged in and render a **single card** above or beside Today’s Plan.
- **Deep links** — Items should carry enough ids for **`OPEN_JOB_HUB`**-style routing (align with existing Today’s Plan CTA contract where possible).
- **Cost** — One GET per dashboard load (or React Query with **`staleTime`** ~1–5 min to avoid hammering); no extra AI calls.

---

## Acceptance criteria

1. **Parity** — For the same user at the same time, **stall counts / membership** match what would go into the digest email for that send window (modulo intentional caps on list length for UI).
2. **Opt-out** — User with **`weeklyStallDigest: false`** does not see actionable stalled content **or** receives **`eligible: false`** with a stable **`reasonIfEmpty`** so the UI can show “You turned off weekly summaries.”
3. **Pause** — Behavior matches email when **`nudgePausedUntil`** is active (either hide marketing summary or mark ineligible—**pick one** and document).
4. **Performance** — p95 reasonable for dashboard TTFB; consider caching keyed by user + digest version.

---

## Open questions for backend / product

1. Should the **in-app card** appear when **`weeklyStallDigest`** is **false** (informational only, no email) or **always hide**? Recommendation: **hide** or show one line “Weekly email off — turn on in Settings” for clarity.
2. Does **`maxMarketingEmailsPerWeek`** affect **in-app** at all, or **email only**? (Current expectation: **email only**. )
3. Single endpoint vs nest under **`/dashboard/today-plan`** — ownership and cache invalidation strategy.

---

## References

- Notification prefs / opt-out: `docs/backend-handoff-notification-defaults-opt-out.md`
- Priority stack / stalled intelligence context: `docs/backend-handoff-priority-stack-stalled-nudges.md`
- Frontend routes: **`/dashboard/next-moves`**, **`/dashboard/jobs`**

---

*Goal in one line: **same stall intelligence as the weekly email, exposed for the dashboard card, one implementation, consistent prefs.***
