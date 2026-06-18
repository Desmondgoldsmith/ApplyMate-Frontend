# Backend handoff — Dev API `ECONNRESET` / socket hang up

**Date:** 2026-06-03  
**Symptoms:** Next dev console shows:

```text
Failed to proxy http://localhost:3000/api/jobs/<id> Error: socket hang up { code: 'ECONNRESET' }
Failed to proxy http://localhost:3000/api/analytics/events Error: socket hang up
```

**Frontend status:** ✅ Mitigations shipped (see below)  
**Backend status:** Action needed — root cause is upstream Nest, not Next.js routing  

---

## What this error means

`ECONNRESET` / **socket hang up** means the **TCP connection to Nest on `:3000` was closed before a complete HTTP response** was sent. The browser (via Next dev proxy) did nothing wrong — the API process:

- Crashed or was restarted mid-request
- Hung until the client/proxy timed out and closed the socket
- Hit an unhandled exception that tore down the connection
- Was overloaded and dropped keep-alive connections
- Blocked the event loop (sync CPU, long GC, deadlock) so no bytes were written

This is **not** a CORS issue and **not** a missing route (those return 404/405 with a body).

---

## Endpoints seen failing (prioritize these)

| Endpoint | Typical trigger |
|----------|-----------------|
| `GET /api/jobs/:id` | Job Hub detail, analyzer load, row prefetch |
| `POST /api/analytics/events` | Funnel / product analytics (fire-and-forget) |

When **multiple job IDs** fail in one page view, Nest is likely **serially blocking** or ** crashing on repeated detail loads** — not separate frontend bugs.

---

## Required backend fixes

### 1. `GET /api/jobs/:id` must not hang or crash

- **Target p95 < 500ms** for detail reads (no AI calls in this path unless explicitly documented).
- Audit for **N+1 queries** (sections, bookmarks, reminders, tailor draft, generated content).
- Wrap handler in **global exception filter** — always return JSON `{ success: false, error: {...} }`, never bare socket close.
- Add **request timeout** (e.g. 30s hard cap) at Nest/HTTP layer for this route.

**Verification:**

```bash
# Repeat 20x — no hang, no process exit
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/api/jobs/JOB_ID"
done
```

### 2. `POST /api/analytics/events` must be fast and non-blocking

- **Target p95 < 100ms** — enqueue to worker/queue or insert single row; do not run heavy logic inline.
- Must **never** take down the process on malformed payload — return 400, not throw.
- If DB is slow, **drop or buffer** events rather than blocking HTTP thread.

### 3. Process stability

- Enable **structured logging** with `X-Request-Id` (frontend sends on CV mutations; extend to all routes).
- Log **uncaughtException** / **unhandledRejection** — these often precede ECONNRESET storms.
- Watch **memory** during Job Hub browsing (leaks show up as gradual then sudden resets).
- Document **required restart** procedure when dev DB migrations leave Nest in bad state.

### 4. Health check

Expose **`GET /api/health`** (or `/api/health/ready`) returning 200 within 50ms:

```json
{ "success": true, "data": { "status": "ok", "db": "up" } }
```

Frontend can use this later for a “API unavailable” banner.

### 5. Keep-alive / connection limits (Node HTTP server)

- Set sensible **`keepAliveTimeout`** aligned with reverse proxy (if any).
- Under load, log when connections are **destroyed** vs **closed gracefully**.

---

## Frontend mitigations (shipped)

| Change | Purpose |
|--------|---------|
| `app/backend-api/[...path]/route.ts` | Replaces Next **rewrite** proxy — 90s timeout, returns **502 JSON** instead of raw `ECONNRESET` spam |
| `axios` 90s timeout + `isBackendConnectionError()` | Clear user message; no infinite hang |
| `shouldRetryFailedQuery` | **No retries** on ECONNRESET / 502 / 503 — stops amplifying a dying backend |
| Exponential `retryDelay` | Reduces burst load on transient 5xx |

After pulling frontend changes, restart **`npm run dev`** in `packages/web` so the new route handler is active.

---

## Dev workflow checklist

1. **One** Nest process on `:3000` (`lsof -i :3000` / `netstat` — kill duplicates).
2. **One** Next dev server on `:3001`.
3. If errors persist after frontend mitigations → **Nest logs** at timestamp of failed `GET /jobs/:id`.
4. Fix backend, then re-run curl loop above.

---

## Acceptance criteria

- [ ] 20 consecutive `GET /api/jobs/:id` → all 200/401, none hang > 2s, Nest process stays up
- [ ] Job Hub open with `?applicationId=` → no console ECONNRESET (may show single 502 JSON if Nest down — expected)
- [ ] `POST /api/analytics/events` → 200/204 under 100ms p95, never crashes process
- [ ] `GET /api/health` → 200

Please reply with Nest log excerpt from one failed request (including stack trace if any) so we can close the loop on the specific handler bug.
