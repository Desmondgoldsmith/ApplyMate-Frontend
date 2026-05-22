# Backend handoff — notification prefs **default on** (opt-out)

## Goal

Users should **receive emails by default** for the channels we expose in **Settings → Notifications**. They only stop receiving mail after they **explicitly set a preference to `false`** (opt-out).

The web client treats **missing keys** as **enabled** (`!== false`) so toggles match behavior **once** server send logic matches.

### Frontend status (aligned with shipped backend)

- **`weeklyStallDigest`**: UI uses **`prefs?.weeklyStallDigest !== false`** (`effectiveWeeklyStallDigest` in `packages/web/src/lib/user-notification-ui.ts`) — same opt-out model as **`emailHubReminderDue`**.
- **PATCH** `{ notificationPrefs: { weeklyStallDigest: false } }` persists opt-out; after GET returns `false`, the Settings toggle stays **off**.

Product/legal: default-on marketing email remains sensitive in some regions — verify consent rules independently of UI defaults.

---

## Contract

### `notificationPrefs` on `GET /users/me`

| Key | Intended default when **absent** or `null` nested | Opt-out |
|-----|---------------------------------------------------|---------|
| `emailHubReminderDue` | **Send** transactional emails when CRM hub reminders are due | `false` → do not email |
| `weeklyStallDigest` | **Send** weekly stall digest (subject to scheduler rules) | `false` → do not send digest |
| `pushHubReminderDue` | **Allow** push when push is implemented (reserved) | `false` → no push |
| `maxMarketingEmailsPerWeek` | Server cap logic when absent (e.g. **3**) — unchanged | User may set 1–21 |

### Implementation expectations

1. **Email send paths** — When deciding whether to send CRM reminder email or weekly digest, treat **missing preference** the same as **`true`** for `emailHubReminderDue` and `weeklyStallDigest` respectively (unless product/legal requires explicit marketing opt-in in a jurisdiction — see below).

2. **PATCH merge** — Partial merge already overwrites per key; **`false`** must be stored so GET returns explicit `false` and user stays opted out.

3. **New users / backfill** — Optional: persist explicit `true` on first login so payloads are self-describing; **not required** if read-time default-on is implemented consistently.

4. **`nudgePausedUntil`** — Unchanged: marketing pause still suppresses paths that **check pause**; do not use pause to imply “email off” for transactional hub reminders unless product specifies.

---

## QA checklist

- New account with **no** `notificationPrefs` → user **still receives** eligible CRM reminder emails and weekly digest (when scheduler fires and content exists).
- After `PATCH` with `notificationPrefs: { weeklyStallDigest: false }` → **no** digest emails until toggled back.
- GET after opt-out returns explicit booleans; frontend toggles stay off.

---

## Compliance note (product/legal)

Weekly digest may be classified as **marketing** in some regions. Confirm whether **default-on** for digest requires explicit consent (e.g. EU). If yes, backend/product may need **region-specific** defaults or onboarding checkbox — this doc assumes product approved **opt-out** defaults.

---

## Frontend reference

- Types: `NotificationPrefs`, `effective*` helpers in `packages/web/src/lib/user-notification-ui.ts`.
- UI: `packages/web/src/app/(dashboard)/dashboard/settings/NotificationsTab.tsx`.
